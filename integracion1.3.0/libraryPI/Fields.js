
const fields = [
    { id: 1, name: 'Código de autorización', length: 6, format: 'ASCII', alias: 'authCode' },
    { id: 30, name: 'BIN de la tarjeta', length: 12, format: 'ASCII', alias: 'cardBIN' },
    { id: 31, name: 'Número de tarjeta', length: 12, format: 'ASCII', alias: 'cardNumber' },
    { id: 40, name: 'Monto compra', length: 12, format: 'ASCII', alias: 'purchaseAmount' },
    { id: 41, name: 'IVA', length: 12, format: 'ASCII', alias: 'IVA' },
    { id: 42, name: 'Número de caja', length: 10, format: 'ASCII', alias: 'cashierNumber' },
    { id: 43, name: 'Número de recibo', length: 6, format: 'ASCII', alias: 'receiptNumber' },
    { id: 44, name: 'RRN', length: 12, format: 'ASCII', alias: 'RRN' },
    { id: 45, name: 'Terminal ID', length: 8, format: 'ASCII', alias: 'terminalID' },
    { id: 46, name: 'Fecha transacción', length: 4, format: 'ASCII', alias: 'transactionDate' },
    { id: 47, name: 'Hora transacción', length: 4, format: 'ASCII', alias: 'transactionTime' },
    { id: 48, name: 'Código de respuesta', length: 2, format: 'ASCII', alias: 'responseCode' },
    { id: 49, name: 'Franquicia', length: 10, format: 'ASCII', alias: 'franchise' },
    { id: 50, name: 'Tipo de cuenta', length: 2, format: 'ASCII', alias: 'accountType' },
    //{ id: 51, name: 'Número de cuotas', length: 2, format: 'ASCII', alias: 'installmentNumber' },
 		{ id: 51, name: 'Número de cuotas', length: 4, format: 'ASCII', alias: 'installmentNumber' },
    { id: 53, name: 'Número de transacción', length: 10, format: 'ASCII', alias: 'transactionNumber' },
    { id: 54, name: 'Últimos 4 dígitos', length: 4, format: 'ASCII', alias: 'last4Digits' },
    { id: 55, name: 'Tipo de documento', length: 1, format: 'ASCII', alias: 'documentType' },
    { id: 56, name: 'Número de documento', length: 11, format: 'ASCII', alias: 'documentNumber' },
    { id: 57, name: 'Número telefónico', length: 8, format: 'ASCII', alias: 'phoneNumber' },
    { id: 58, name: 'Código del banco', length: 2, format: 'ASCII', alias: 'bankCode' },
    { id: 59, name: 'Número de cuenta', length: 13, format: 'ASCII', alias: 'accountNumber' },
    { id: 60, name: 'Número de cheque', length: 10, format: 'ASCII', alias: 'chequeNumber' },
    { id: 61, name: 'Mensaje de error', length: 7, format: 'ASCII', alias: 'errorMessage' }, //69
    { id: 62, name: 'Holder name', length: 26, format: 'ASCII', alias: 'cardHolderName' },
    { id: 63, name: 'Criptograma', length: 16, format: 'ASCII', alias: 'cryptogram' },
    { id: 64, name: 'TVR', length: 10, format: 'ASCII', alias: 'TVR' },
    { id: 66, name: 'TSI', length: 4, format: 'ASCII', alias: 'TSI' },
    { id: 67, name: 'AID', length: 32, format: 'ASCII', alias: 'AID' },
    //{ id: 68, name: 'Label', length: 12, format: 'ASCII', alias: 'label' },
		{ id: 68, name: 'Moneda', length: 2, format: 'ASCII', alias: 'currency' },
    { id: 69, name: 'Fecha vencimiento cheque 4', length: 16, format: 'ASCII', alias: 'chequeExpirationDate4' },
    { id: 70, name: 'Valor cheque 5', length: 12, format: 'ASCII', alias: 'chequeValue5' },
    { id: 71, name: 'Fecha vencimiento cheque 5', length: 4, format: 'ASCII', alias: 'chequeExpirationDate5' },
		{ id: 72, name: 'KeyPago', length: 3, format: 'ASCII', alias: 'keyPago' },
    { id: 73, name: 'Valor cheque 6', length: 12, format: 'ASCII', alias: 'chequeValue6' },
    { id: 74, name: 'Fecha vencimiento cheque 6', length: 4, format: 'ASCII', alias: 'chequeExpirationDate6' },
    { id: 75, name: 'BIN Tarjeta', length: 6, format: 'ASCII', alias: 'cardBINTarjeta' },
    { id: 76, name: 'Fecha de vencimiento tarjeta', length: 4, format: 'ASCII', alias: 'cardExpirationDate' },
    { id: 77, name: 'Código comercio', length: 23, format: 'ASCII', alias: 'merchantCode' },
    { id: 78, name: 'Dirección establecimiento', length: 23, format: 'ASCII', alias: 'establishmentAddress' },
    { id: 79, name: 'Label', length: 2, format: 'ASCII', alias: 'label' },
    { id: 80, name: 'Valor base devolución', length: 12, format: 'ASCII', alias: 'refundBaseAmount' },
    { id: 81, name: 'Propina', length: 12, format: 'ASCII', alias: 'tip' },
    { id: 82, name: 'N/A', length: 12, format: 'ASCII', alias: 'N/A' },
    { id: 83, name: 'Id cajero', length: 12, format: 'ASCII', alias: 'cashierId' },
    { id: 84, name: 'Valor tasa administrativa', length: 12, format: 'ASCII', alias: 'administrativeFeeAmount' },
    { id: 85, name: 'IVA tasa administrativa', length: 12, format: 'ASCII', alias: 'administrativeFeeIVA' },
    { id: 86, name: 'Base devolución IVA tasa administrativa', length: 12, format: 'ASCII', alias: 'refundBaseAdministrativeFeeIVA' },
    { id: 87, name: 'Solicitud nueva pantalla', length: 2, format: 'HEXA', alias: 'newScreenRequest' },
    { id: 88, name: 'Tipo de cuenta selección', length: 1, format: 'ASCII', alias: 'selectedAccountType' }, //12 => 1
    //{ id: 89, name: 'N/A', length: 12, format: 'ASCII', alias: 'N/A' },
		{ id: 89, name: 'CPF QR PIX', length: 11, format: 'ASCII', alias: 'cpfPix' },
    { id: 90, name: 'Cantidad transacciones cierre', length: 4, format: 'ASCII', alias: 'closingTransactionCount' }, //4
    //{ id: 91, name: 'N/A', length: 12, format: 'ASCII', alias: 'N/A' },
		{ id: 91, name: 'Red cripto', length: 12, format: 'ASCII' },
    { id: 92, name: 'N/A', length: 12, format: 'ASCII', alias: 'N/A' },
    { id: 93, name: 'Track 1', length: 76, format: 'ASCII', alias: 'track1' },
    { id: 94, name: 'Track 2', length: 37, format: 'ASCII', alias: 'track2' },
    { id: 95, name: 'PAN tarjeta', length: 19, format: 'ASCII', alias: 'cardPAN' },
    { id: 96, name: 'SN', length: 19, format: 'ASCII', alias: 'SN' },
    { id: 97, name: 'Recaudo éxito', length: 19, format: 'ASCII', alias: 'collectionSuccess' },
    { id: 98, name: 'Código aerolínea', length: 2, format: 'ASCII', alias: 'airlineCode' },
    { id: 99, name: 'N/A', length: 12, format: 'ASCII', alias: 'N/A' },
];

const mensajesDeError = {
    "01": "TIEMPO DE ESPERA AGOTADO (TIME OUT)",
    "02": "INCIDENTE AL LEER TARJETA",
    "03": "TRANSACCIÓN NO EXISTE",
    "04": "NO EXISTEN TRANSACCIONES",
    "05": "LA TRANSACCIÓN YA ESTÁ ANULADA",
    "07": "LOTE LLENO, REALICE CIERRE",
    "08": "MONTO INVÁLIDO",
    "09": "TARJETA NO SOPORTADA",
    "10": "LA TARJETA NO ES LA ORIGINAL",
    "11": "TARJETA EXPIRADA",
    "12": "USUARIO CANCELÓ",
    "13": "PIN INVÁLIDO",
    "14": "TRANSACCIÓN NO PERMITIDA",
    "16": "INCIDENTE EN LA BÚSQUEDA DE LA TARJETA",
    "17": "INCIDENTE DURANTE EL PROCESO DE TRANSACCIÓN",
    "18": "MENSAJE INESPERADO",
    "19": "INCIDENTE EN LA PANTALLA DE PIN",
    "20": "INCIDENTE DE COMUNICACIÓN",
    "default": "INCIDENTE DE COMUNICACIÓN"
};

const responses = {
    '00': 'TRANS. APROBADA',
    '01-02': 'CONTACTE / BANCO',
    '03': 'COMERCIO INVALID',
    '04': 'TARJ. OBSERVADA',
    '*default': 'TRANS. RECHAZADA',
    '07': 'TARJ. OBSERVADA',
    '12': 'TRANS. INVALIDA',
    '13': 'MONTO INVALIDO',
    '14': 'TARJETA INVALIDA',
    '17': 'BANCO INVALIDA',
    '19': 'BANCO NO RESPOND',
    '20': 'RTA INVALIDA',
    '30': 'ERROR DE FORMATO',
    '33': 'TARJ. EXPIRADA',
    '36': 'TARJ.RESTRINGIDA',
    '38': 'EXCEDE INT. PIN',
    '41': 'TARJETA PERDIDA',
    '42': 'CUENTA NO ENCON.',
    '43': 'TARJETA PERDIDA',
    '45': 'DEPOSITE LOTE',
    '50': 'SIN RESPUESTA',
    '51': 'FONDOS INSUFICI.',
    '08-10-11-15-16-32-34-37-39-40-52-53-56-57-59-60': 'TRANS. RECHAZADA',
    '54': 'TARJETA VENCIDA',
    '55': 'PIN INVALIDO',
    '58': 'CUENTA NO ENCON.',
    '61': 'EXCEDE LIMITE',
    '62': 'TARJ. RESTRINGID',
    '65': 'EXCEDE LIMITE',
    '67': 'TARJETA OBSERVAD',
    '68': 'SIN RESPUESTA',
    '75': 'EXCEDE INT. PIN',
    '76': 'ERROR COD. PROD.',
    '77': 'TRANS. DCC',
    '78': 'TRAMA NO ENCONT.',
    '80': 'LINEA DESCONECT.',
    '81': 'LINEA OCUPADA',
    '82': 'NO CONTESTA',
    '83': 'NO HAY TONO',
    '84': 'ERROR DE COMUN.',
    '85': 'LOTE NO ENCONTR.',
    '87': 'OPER. CANCELADA',
    '88': 'ERROR CONEXION',
    '89': 'TCP ERROR',
    '90': 'REVERSA PENDIENT',
    '91': 'BANCO NO RESPOND',
    '92': 'BANCO NO RESPOND',
    '94': 'TRAMA DUPLICADA',
    '95': 'TRANS. DE LOTES',
    '96': 'SIS. CON ERROR',
    'AP': 'TRANS. APROBADA',
    'BL': 'BATERIA BAJA',
    'CN': 'TRANS. CANCELADA',
    'DE': 'DATOS ERRONEOS',
    'HO-NC': 'INTENTE DE NUEVO',
    'IP': 'LLAMAR A ATC IP',
    'IR': 'LLAMAR A ATC IR',
    'IS': 'LLAMAR A ATC IS',
    'IT': 'LLAMAR A ATC IT',
    'LC': 'INTENTE DE NUEVO',
    'LN': 'NO HAY TONO',
    'LO': 'LINEA OCUPADA',
    'MA': 'DESLICE TARJETA',
    'RE': 'ERROR EN LA LECTURA',
    'SB': 'TARJETA BLOQUEAD',
    'SC': 'DESLICE TAJ.AMEX',
    'SE': 'ERROR DEL SISTEM',
    'TA': 'TRANS. ACEPTADA',
    'TO': 'INTENTE DE NUEVO',
    'VS': 'VERIFIQUE FIRMA',
    'UC': 'TJ. NO SOPORTADA',
    'PR': 'TRANS. PROCESADA',
    '**': 'BANCO INVALIDO'
};


exports.fields = fields;

exports.getResponseByCode=function(code) {
    for (const [key, message] of Object.entries(responses)) {
        const codes = key.split('-');
        if (codes.includes(code)) {
            return message;
        }
    }
    return responses['*default'] || 'Código no encontrado';
}

exports.getResponseByCodeError=function(code) {
 
    if(mensajesDeError[code.toString()]){
        return mensajesDeError[code.toString()];
    }
    return mensajesDeError['default'] || 'Código no encontrado';
}
exports.getFields = function (ids) {
    return fields.filter(field => ids.includes(field.id));
}

exports.getField = function (id) {
    return fields.find(field => field.id === id);
}
