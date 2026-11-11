; Instalador del integrador POS para el PC de cada caja (Plan C).
; Se compila con build.ps1 en Windows; ver README.md.

#ifndef AppVersion
  #define AppVersion "1.3.0"
#endif

[Setup]
AppId={{1A62AF61-A063-44D1-B4EA-2E19A538FEE2}
AppName=POS Integrador
AppVersion={#AppVersion}
AppPublisher=Sintesis
DefaultDirName={autopf}\POS Integrador
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
OutputDir=dist
OutputBaseFilename=pos-integrador-setup-{#AppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
InfoBeforeFile=instrucciones.txt
UninstallDisplayName=POS Integrador

[Languages]
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
Source: "staging\app\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "staging\node\node.exe"; DestDir: "{app}\node"; Flags: ignoreversion
Source: "staging\winsw\WinSW-x64.exe"; DestDir: "{app}"; DestName: "POSIntegrador.exe"; Flags: ignoreversion
Source: "POSIntegrador.xml"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
Name: "{app}\logs"

[Icons]
Name: "{commondesktop}\POS Integrador (kiosk)"; Filename: "{app}\kiosk.url"

[UninstallDelete]
Type: filesandordirs; Name: "{app}\logs"
Type: files; Name: "{app}\.env"
Type: files; Name: "{app}\devices.json"
Type: files; Name: "{app}\kiosk.url"

[Code]
const
  ServiceName = 'POSIntegrador';
  FirewallRule = 'POS Integrador';

var
  InputPage: TInputQueryWizardPage;
  ServiceExisted: Boolean;

function ServiceExists: Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec(ExpandConstant('{sys}\sc.exe'), 'query ' + ServiceName, '', SW_HIDE, ewWaitUntilTerminated, ResultCode)
    and (ResultCode = 0);
end;

// Ejecuta un comando de consola y deja su salida en un archivo.
function RunToFile(const Cmd, OutFile: String): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec(ExpandConstant('{cmd}'), '/S /C "' + Cmd + ' > "' + OutFile + '" 2>&1"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode)
    and (ResultCode = 0);
end;

function IsDigits(const S: String): Boolean;
var
  I: Integer;
begin
  Result := Length(S) > 0;
  for I := 1 to Length(S) do
    if (S[I] < '0') or (S[I] > '9') then
      Result := False;
end;

function IsValidIPv4(const S: String): Boolean;
var
  Rest, Part: String;
  P, I, N: Integer;
begin
  Result := False;
  Rest := S;
  for I := 1 to 4 do
  begin
    if I < 4 then
    begin
      P := Pos('.', Rest);
      if P = 0 then Exit;
      Part := Copy(Rest, 1, P - 1);
      Rest := Copy(Rest, P + 1, Length(Rest));
    end
    else
      Part := Rest;
    if (not IsDigits(Part)) or (Length(Part) > 3) then Exit;
    N := StrToIntDef(Part, -1);
    if (N < 0) or (N > 255) then Exit;
  end;
  Result := True;
end;

function IsValidName(const S: String): Boolean;
var
  I: Integer;
  C: String;
begin
  Result := Length(S) > 0;
  for I := 1 to Length(S) do
  begin
    C := Copy(S, I, 1);
    if not (((C >= 'A') and (C <= 'Z')) or ((C >= 'a') and (C <= 'z')) or ((C >= '0') and (C <= '9')) or (C = '_') or (C = '-')) then
      Result := False;
  end;
  // El integrador no acepta nombres con forma de IP.
  if Result and IsValidIPv4(S) then
    Result := False;
end;

function ParseTwoInts(const Line: String; var A, B: Integer): Boolean;
var
  T: String;
  P: Integer;
begin
  Result := False;
  T := Line;
  StringChangeEx(T, '*', ' ', True);
  T := Trim(T);
  P := Pos(' ', T);
  if P = 0 then Exit;
  A := StrToIntDef(Trim(Copy(T, 1, P - 1)), -1);
  B := StrToIntDef(Trim(Copy(T, P + 1, Length(T))), -1);
  Result := (A >= 0) and (B >= 0);
end;

// Hyper-V, WSL y Docker reservan rangos de puertos que no se pueden abrir.
function PortInExcludedRange(Port: Integer): Boolean;
var
  OutFile: String;
  Lines: TArrayOfString;
  I, A, B: Integer;
begin
  Result := False;
  OutFile := ExpandConstant('{tmp}\excluded_ports.txt');
  if not RunToFile('netsh int ipv4 show excludedportrange protocol=tcp', OutFile) then Exit;
  if not LoadStringsFromFile(OutFile, Lines) then Exit;
  for I := 0 to GetArrayLength(Lines) - 1 do
    if ParseTwoInts(Lines[I], A, B) then
      if (Port >= A) and (Port <= B) then
        Result := True;
end;

// Un puerto en escucha aparece con destino 0.0.0.0:0 o [::]:0 (independiente del idioma).
function PortInUse(Port: Integer): Boolean;
var
  OutFile: String;
  Lines: TArrayOfString;
  I: Integer;
begin
  Result := False;
  OutFile := ExpandConstant('{tmp}\netstat.txt');
  if not RunToFile('netstat -ano -p tcp', OutFile) then Exit;
  if not LoadStringsFromFile(OutFile, Lines) then Exit;
  for I := 0 to GetArrayLength(Lines) - 1 do
    if (Pos(':' + IntToStr(Port) + ' ', Lines[I]) > 0)
      and ((Pos(' 0.0.0.0:0', Lines[I]) > 0) or (Pos(' [::]:0', Lines[I]) > 0)) then
      Result := True;
end;

function ValidateInputs(var Msg: String): Boolean;
var
  PosPort, ApiPort: Integer;
begin
  Result := False;
  PosPort := StrToIntDef(Trim(InputPage.Values[2]), -1);
  ApiPort := StrToIntDef(Trim(InputPage.Values[3]), -1);

  if not IsValidName(Trim(InputPage.Values[0])) then
    Msg := 'El nombre del terminal solo admite letras, números, guion y guion bajo, y no puede tener forma de IP.'
  else if not IsValidIPv4(Trim(InputPage.Values[1])) then
    Msg := 'La IP del terminal no es válida (ejemplo: 192.168.1.50).'
  else if (PosPort < 1024) or (PosPort > 32767) then
    Msg := 'El puerto del POS debe estar entre 1024 y 32767.'
  else if (ApiPort < 1024) or (ApiPort > 65535) then
    Msg := 'El puerto de la API debe estar entre 1024 y 65535.'
  else if PosPort = ApiPort then
    Msg := 'El puerto del POS y el de la API deben ser distintos.'
  else if PortInExcludedRange(PosPort) then
    Msg := 'El puerto ' + IntToStr(PosPort) + ' está reservado por Windows (Hyper-V, WSL o Docker). Elija otro.'
  else if (not ServiceExisted) and PortInUse(PosPort) then
    Msg := 'El puerto ' + IntToStr(PosPort) + ' ya está en uso por otro proceso. Elija otro.'
  else if (not ServiceExisted) and PortInUse(ApiPort) then
    Msg := 'El puerto ' + IntToStr(ApiPort) + ' ya está en uso por otro proceso. Elija otro.'
  else
    Result := True;
end;

procedure InitializeWizard;
begin
  ServiceExisted := ServiceExists;
  InputPage := CreateInputQueryPage(wpInfoBefore,
    'Configuración del terminal',
    'Datos del terminal POS de esta caja',
    'Estos valores se guardan en .env y devices.json. Para cambiarlos más adelante, vuelva a ejecutar el instalador.');
  InputPage.Add('Nombre del terminal (por ejemplo POS01):', False);
  InputPage.Add('IP fija del terminal POS:', False);
  InputPage.Add('Puerto del POS (el terminal se conecta a este puerto de este PC):', False);
  InputPage.Add('Puerto de la API local (solo atiende en este PC):', False);
  InputPage.Values[0] := ExpandConstant('{param:TERMINALNAME|POS01}');
  InputPage.Values[1] := ExpandConstant('{param:TERMINALIP|}');
  InputPage.Values[2] := ExpandConstant('{param:POSPORT|15455}');
  InputPage.Values[3] := ExpandConstant('{param:APIPORT|3000}');
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  Msg: String;
begin
  Result := True;
  if CurPageID = InputPage.ID then
  begin
    Result := ValidateInputs(Msg);
    if not Result then
      MsgBox(Msg, mbError, MB_OK);
  end;
end;

function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo, MemoTypeInfo, MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
begin
  Result := 'Terminal: ' + Trim(InputPage.Values[0]) + ' (' + Trim(InputPage.Values[1]) + ')' + NewLine +
    'Puerto del POS: ' + Trim(InputPage.Values[2]) + NewLine +
    'Puerto de la API local: ' + Trim(InputPage.Values[3]) + NewLine + NewLine +
    'Se instalará el servicio de Windows ' + ServiceName + ' y una regla de firewall que permite el puerto del POS solo desde la IP del terminal.';
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Msg: String;
  ResultCode: Integer;
begin
  Result := '';
  // En instalación silenciosa no se pasa por la página: se valida aquí también.
  if not ValidateInputs(Msg) then
  begin
    Result := Msg;
    Exit;
  end;
  if ServiceExisted then
  begin
    Exec(ExpandConstant('{sys}\sc.exe'), 'stop ' + ServiceName, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Sleep(4000);
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  App, PosName, PosIp, PosPort, ApiPort: String;
  ResultCode: Integer;
begin
  if CurStep <> ssPostInstall then Exit;

  App := ExpandConstant('{app}');
  PosName := Trim(InputPage.Values[0]);
  PosIp := Trim(InputPage.Values[1]);
  PosPort := Trim(InputPage.Values[2]);
  ApiPort := Trim(InputPage.Values[3]);

  SaveStringToFile(App + '\.env',
    'POS_PORT=' + PosPort + #13#10 +
    'API_PORT=' + ApiPort + #13#10 +
    'API_HOST=127.0.0.1' + #13#10 +
    'POS_OPERATION_TIMEOUT_MS=40000' + #13#10, False);
  SaveStringToFile(App + '\devices.json',
    '{ "' + PosName + '": "' + PosIp + '" }' + #13#10, False);
  SaveStringToFile(App + '\kiosk.url',
    '[InternetShortcut]' + #13#10 + 'URL=http://localhost:' + ApiPort + '/' + #13#10, False);

  // Regla de entrada: el puerto del POS solo desde la IP del terminal.
  Exec(ExpandConstant('{sys}\netsh.exe'), 'advfirewall firewall delete rule name="' + FirewallRule + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  if not Exec(ExpandConstant('{sys}\netsh.exe'),
      'advfirewall firewall add rule name="' + FirewallRule + '" dir=in action=allow protocol=TCP localport=' + PosPort + ' remoteip=' + PosIp,
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode) or (ResultCode <> 0) then
    MsgBox('No se pudo crear la regla de firewall. Créela a mano: puerto TCP ' + PosPort + ' desde ' + PosIp + '.', mbError, MB_OK);

  if not ServiceExisted then
    if not Exec(App + '\POSIntegrador.exe', 'install', App, SW_HIDE, ewWaitUntilTerminated, ResultCode) or (ResultCode <> 0) then
      MsgBox('No se pudo registrar el servicio ' + ServiceName + '. Revise App\logs y ejecute POSIntegrador.exe install como administrador.', mbError, MB_OK);

  if not Exec(ExpandConstant('{sys}\sc.exe'), 'start ' + ServiceName, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) or (ResultCode <> 0) then
    MsgBox('No se pudo iniciar el servicio ' + ServiceName + '. Revise App\logs.', mbError, MB_OK);
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
begin
  if CurUninstallStep <> usUninstall then Exit;
  Exec(ExpandConstant('{sys}\sc.exe'), 'stop ' + ServiceName, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(4000);
  Exec(ExpandConstant('{app}\POSIntegrador.exe'), 'uninstall', ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(ExpandConstant('{sys}\netsh.exe'), 'advfirewall firewall delete rule name="' + FirewallRule + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;
