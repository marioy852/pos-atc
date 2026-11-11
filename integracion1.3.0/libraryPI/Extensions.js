
const fields = require("./Fields");

const DELIMITER = "1C";
const SENDDEFAULT = "02";
const FINISH = "03";
String.prototype.removeSpaces = function () {
    return this.replace(/\s/g, '');
};
String.prototype.logger = function () {
    console.log(`${new Date().toISOString().replace('T', ' ').split('.')[0]} | ${this}`);
};

String.prototype.isAck = function () {
    return this == "06";
};

String.prototype.isNAck = function () {
    return this == "15";
};

String.prototype.asciiToHex = function () {
    return this.split('').map(char => char.charCodeAt(0).toString(16)).join('');
};

String.prototype.hexToAscii = function () {
    let hex = this.toString();
    let str = '';
    for (let i = 0; i < hex.length && hex.substr(i, 2) !== '00'; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
};
String.prototype.hexToAscii01 = function () {
    let hex = this.toString();
    let asciiString = '';
    for (let i = 0; i < hex.length; i += 2) {
        let hexPair = hex.substr(i, 2);
        asciiString += String.fromCharCode(parseInt(hexPair, 16));
    }
    return asciiString;
};
Number.prototype.toHexSigned2Complement = function () {
    let num = this;
    if (num < 0) {
        num = 0xFFFF + num + 1;
    }
    let hex = num.toString(16).toUpperCase();
    return hex.padStart(4, '0');
};

String.prototype.xor = function () {
    let msgHex = this.toString();
    let buff = Buffer.from(msgHex, 'hex');
    let x = 0;
    let len = buff.length;
    for (let i = 0; i < len; ++i) {
        x ^= buff[i];
    }
    return ('0' + x.toString(16)).slice(-2);

};

String.prototype.validateAmount = function () {
    let amount = this.toString().replace(/[.,]/g, '');
    let num = parseInt(amount).toString().padStart(12, '0');
    return num;
};

// String.prototype.validateReference = function () {
//     return this.toString().padStart(6, '0').substr(-6);
// };

String.prototype.validateReference = function () {
    const ref = this.toString().trim();
    return ref.length <= 6 ? ref.padStart(6, '0') : ref;
};

String.prototype.toFloatDecimals = function () {
    let cadenaLimpia = this.replace(/^0+/, '');
    if (cadenaLimpia === '') {
        cadenaLimpia = '0';
    }
    let numeroFlotante = parseFloat(cadenaLimpia) / 100;
    return numeroFlotante.toFixed(2);
};

String.prototype.formatField = function () {
    const hexStr = this.toString();
    const fieldId = parseInt(hexStr.slice(0, 4).hexToAscii());
    const resultField = fields.getField(fieldId);
    
    const lengthHex = resultField.length * 2;
    const value = resultField.format === "ASCII" ? hexStr.substr(8, lengthHex).hexToAscii() : hexStr.substr(8, lengthHex);
    return {
        id: fieldId,
        name: resultField.alias,
        value: value,
        description: resultField.name
    };
};
String.prototype.unpackMessage = function () {
    let message = this.toString();
    message = message.slice(26)

    let fieldArray = message.toUpperCase().split("1C");

    const firstElement = fieldArray.shift().hexToAscii().removeSpaces();

    var dataArray = [];

    for (const iterator of fieldArray) {
        if(iterator !=""){
            let format = iterator.formatField();
            dataArray[format.id] = format;
        }
    }

    return {
        identifier: firstElement,
        data: dataArray
    };
}

String.prototype.packMessage = function (list, values) {
    let result = "";
    for (const rows of list) {
        if (values[rows.id]) {
            let code = (rows.id).toString().padStart(2, "0").asciiToHex();
            let lengths = (rows.length).toHexSigned2Complement();
            
            result += (code + lengths + values[rows.id].asciiToHex()) + DELIMITER;
        }
    }
 
    result = this + result.slice(0, -DELIMITER.length);

    let xor = (result + FINISH).toString().xor();
 //FINISH
    return (SENDDEFAULT + result)+ FINISH + xor;
};

String.prototype.packFields = function (list, values) {
    let result = "";
    for (const rows of list) {
        if (values[rows.id]) {
            let code = (rows.id).toString().padStart(2, "0").asciiToHex();
            let lengths = (rows.length).toHexSigned2Complement();
            result += code + lengths + values[rows.id].asciiToHex() + DELIMITER;
        }
    }
    // Quitar el último delimitador
    return result.slice(0, -DELIMITER.length);
};

String.prototype.packFieldsWithList = function (list, values) {
    let result = "";
    for (const rows of list) {
        if (values[rows.id]) {
            let code = (rows.id).toString().padStart(2, "0").asciiToHex();
            let lengths = (rows.length).toHexSigned2Complement();
            result += code + lengths + values[rows.id].asciiToHex() + DELIMITER;
        }
    }
    return result.slice(0, -DELIMITER.length);
};

String.prototype.packFinalMessage = function (mensajeCompleto) {
    const longitudBytes = Buffer.from(mensajeCompleto, 'hex').length;
		const longitudBCD = longitudBytes.toString().padStart(4, '0');
		const mensajeParaXor=longitudBCD+mensajeCompleto+FINISH;
		let xor = (mensajeParaXor).toString().xor();
		const tramaFinal=SENDDEFAULT+mensajeParaXor+xor;
    return tramaFinal;
};

