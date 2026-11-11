const { EventEmitter } = require("events");

const STX = 0x02;
const ETX = 0x03;
const ACK = 0x06;
const NAK = 0x15;
const ENQ = 0x05;

const SINGLE_BYTE_CONTROLS = new Set([ACK, NAK, ENQ]);


class PosFrameReader extends EventEmitter {
  constructor({ maxBufferBytes = 8192 } = {}) {
    super();
    this.buffer = Buffer.alloc(0);
    this.maxBufferBytes = maxBufferBytes;
  }

  /** Alimentar con un chunk crudo recién llegado del socket ("data"). */
  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, Buffer.from(chunk)]);

    if (this.buffer.length > this.maxBufferBytes) {
      this.emit("frameError", {
        reason: "buffer_overflow",
        message: `Buffer supero ${this.maxBufferBytes} bytes sin resolver una trama; se descarta todo.`,
      });
      this.buffer = Buffer.alloc(0);
      return;
    }

    this._drain();
  }

  reset() {
    this.buffer = Buffer.alloc(0);
  }

  _drain() {

    while (this.buffer.length > 0) {
      const first = this.buffer[0];

      if (SINGLE_BYTE_CONTROLS.has(first)) {
        const frame = Buffer.from(this.buffer.subarray(0, 1));
        this.buffer = this.buffer.subarray(1);
        this.emit("message", frame);
        continue;
      }

      if (first !== STX) {

        this.emit("frameError", {
          reason: "unexpected_byte",
          byte: first,
          message: `Byte inesperado 0x${first.toString(16).padStart(2, "0")} fuera de una trama; se descarta y se resincroniza.`,
        });
        this.buffer = this.buffer.subarray(1);
        continue;
      }

      if (this.buffer.length < 3) return;

      const lenBytes = this.buffer.subarray(1, 3);
      const bodyLength = this._decodeBcdLength(lenBytes);

      if (bodyLength === null) {
        this.emit("frameError", {
          reason: "invalid_length_bcd",
          message: "Longitud BCD invalida (nibbles fuera de 0-9).",
        });
        this.buffer = this.buffer.subarray(1);
        continue;
      }

      const totalFrameLength = 1 /* STX */ + 2 /* LEN */ + bodyLength + 1 /* ETX */ + 1 /* XOR */;


      if (this.buffer.length < totalFrameLength) return;

      const frame = this.buffer.subarray(0, totalFrameLength);
      const etxByte = frame[3 + bodyLength];
      const xorByte = frame[3 + bodyLength + 1];
      const xorScope = frame.subarray(1, 3 + bodyLength + 1); // LEN + BODY + ETX
      const computedXor = this._xor(xorScope);

      if (etxByte !== ETX) {
        this.emit("frameError", {
          reason: "invalid_etx",
          message: `ETX invalido (0x${etxByte.toString(16).padStart(2, "0")}); trama descartada.`,
          frame: Buffer.from(frame),
        });
        this.buffer = this.buffer.subarray(1); // resincronizar desde el siguiente byte
        continue;
      }

      if (computedXor !== xorByte) {
        this.emit("frameError", {
          reason: "invalid_xor",
          message: `XOR invalido (esperado 0x${computedXor.toString(16).padStart(2, "0")}, recibido 0x${xorByte.toString(16).padStart(2, "0")}); trama descartada.`,
          frame: Buffer.from(frame),
        });
        this.buffer = this.buffer.subarray(1); // resincronizar
        continue;
      }

      this.buffer = this.buffer.subarray(totalFrameLength);
      this.emit("message", Buffer.from(frame));
    }
  }

  _decodeBcdLength(twoBytes) {
    let digits = "";
    for (const byte of twoBytes) {
      const hi = (byte >> 4) & 0x0f;
      const lo = byte & 0x0f;
      if (hi > 9 || lo > 9) return null;
      digits += String(hi) + String(lo);
    }
    return parseInt(digits, 10);
  }

  _xor(buf) {
    let x = 0;
    for (const byte of buf) x ^= byte;
    return x;
  }
}

module.exports = { PosFrameReader, STX, ETX, ACK, NAK, ENQ };
