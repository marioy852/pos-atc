# Instalador del integrador POS (Windows)

Instalador con asistente para el PC de cada caja (Plan C). Instala el integrador con su propio `node.exe`, lo registra como servicio de Windows, crea la regla de firewall y pide la configuración del terminal durante la instalación.

**Estado: escrito pero nunca compilado ni probado.** Se escribió en Linux, sin Inno Setup ni Windows. La primera compilación y la primera instalación son la prueba; corregir lo que falle y actualizar este archivo.

## Compilar (en una máquina con Windows)

Requisitos: Node.js con npm, [Inno Setup 6](https://jrsoftware.org/isinfo.php) e internet.

```
powershell -ExecutionPolicy Bypass -File installer\build.ps1
```

Prepara `installer\staging` (código, `npm ci --omit=dev`, `node.exe` verificado con el SHASUMS256 de Node y WinSW) y compila con `ISCC`. El resultado queda en `installer\dist\pos-integrador-setup-<versión>.exe`. Si Inno Setup está en otra ruta, usar `-Iscc "<ruta>\ISCC.exe"`.

## Instalar

Ejecutar el `.exe` como administrador. Páginas: instrucciones, datos del terminal (nombre, IP, puerto del POS, puerto de la API), resumen e instalación.

Instalación sin ventanas, para varias cajas:

```
pos-integrador-setup-1.3.0.exe /VERYSILENT /TERMINALNAME=POS01 /TERMINALIP=<IP-del-terminal> /POSPORT=15455 /APIPORT=3000
```

`/TERMINALIP` es obligatorio. Si un dato no es válido, la instalación se detiene con el motivo.

Qué valida: nombre sin forma de IP, IP válida, puerto del POS entre 1024 y 32767, puerto de la API entre 1024 y 65535 y distinto, puerto no reservado por Windows (`netsh int ipv4 show excludedportrange`) y no en uso (se omite si ya existe el servicio, por una actualización).

## Qué deja instalado

En `C:\Program Files\POS Integrador`: el integrador, `node\node.exe`, `POSIntegrador.exe` (WinSW) y su `.xml`, `.env`, `devices.json`, `logs\` y `kiosk.url`; el servicio `POSIntegrador` con arranque automático y reinicio ante fallos; la regla de firewall `POS Integrador`; un acceso directo al kiosk en el escritorio.

Actualizar: ejecutar la versión nueva encima; detiene el servicio, reemplaza archivos y reescribe `.env` y `devices.json` con los valores ingresados. Desinstalar: desde Aplicaciones de Windows; quita el servicio, la regla, `.env`, `devices.json` y `logs`.

## Lista de prueba en Windows

1. Compilar sin errores (`build.ps1` y `ISCC`).
2. Instalar con el asistente; probar valores inválidos (nombre con forma de IP, puerto 80, puerto repetido).
3. Con `services.msc`, confirmar que `POS Integrador` está en ejecución y en Automático.
4. `netstat -ano | findstr :15455` debe mostrar el puerto en escucha; `http://localhost:3000/dispositivos` debe responder.
5. `netsh advfirewall firewall show rule name="POS Integrador"` debe mostrar el puerto y la IP del terminal.
6. Configurar el terminal con la IP del PC y el puerto, y comprobar que conecta y que pago, anulación y cierre de lote responden.
7. Reiniciar el PC: el servicio debe arrancar solo y el terminal reconectar.
8. Instalar encima (actualización) y desinstalar: no deben quedar servicio ni regla.
9. Probar la instalación silenciosa con los parámetros de arriba.

## Sin verificar

- El nombre de idioma `compiler:Languages\Spanish.isl` y la sintaxis `{param:TERMINALIP|}` (valor por defecto vacío).
- Que WinSW 2.12.0 acepte exactamente `POSIntegrador.xml` y descargue desde la URL del script; WinSW-x64 requiere .NET Framework 4.6.1 o superior.
- Que el servicio, que corre como `LocalSystem`, pueda escribir `logs\` y los archivos de estado en `Program Files`.
- La detección de puerto en uso con `netstat` en Windows con otro idioma.
- Que el antivirus no bloquee `node.exe` o `POSIntegrador.exe` sin firma. No hay firma de código.
