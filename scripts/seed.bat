@echo off
REM OhanApp - Script para cargar datos iniciales (Windows)
REM Uso: seed.bat

echo 🌱 Cargando datos iniciales en la base de datos...
node src\db\seeders.js
echo ✅ Datos cargados exitosamente
pause
