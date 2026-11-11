function getLaPazTimestamp() {
  const now = new Date();
  const options = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false, // Formato de 24 horas
    timeZone: "America/La_Paz", // Zona horaria para La Paz
  };
  const timestamp = new Intl.DateTimeFormat("en-GB", options).format(now);
  return timestamp; // Retorna la fecha con el formato 'DD/MM/YYYY, HH:mm:ss'
}

module.exports = {getLaPazTimestamp};