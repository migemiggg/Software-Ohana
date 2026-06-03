#!/bin/bash
# OhanApp - Script para cargar datos iniciales
# Uso: bash scripts/seed.sh

echo "🌱 Cargando datos iniciales en la base de datos..."
node src/db/seeders.js
echo "✅ Datos cargados exitosamente"
