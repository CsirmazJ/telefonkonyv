#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Telefonkönyv V0.01 – Docker image builder
# Futtasd ezt SSH-n keresztül a NAS-on, MIELŐTT Portainerben deployolod!
# ─────────────────────────────────────────────────────────────────────────────

set -e

IMAGE_NAME="telefonkonyv"
IMAGE_TAG="v0.01"
FULL_TAG="${IMAGE_NAME}:${IMAGE_TAG}"

# Ellenőrzés: a script a megfelelő könyvtárból fut-e?
if [ ! -f "Dockerfile" ]; then
  echo "❌ Hiba: nem találom a Dockerfile-t."
  echo "   Futtasd ezt a scriptet abból a könyvtárból, ahová kicsomagoltad a fájlokat!"
  exit 1
fi

echo "🔨 Docker image buildelése: ${FULL_TAG}"
echo "   Ez eltarthat 3-5 percig (Node.js, React build, native modulok fordítása)..."
echo ""

docker build -t "${FULL_TAG}" .

echo ""
echo "✅ Sikeres build! Az image készen áll:"
docker images "${IMAGE_NAME}" --format "   {{.Repository}}:{{.Tag}}  ({{.Size}})"
echo ""
echo "👉 Következő lépés: Portainerben hozd létre a stacket a docker-compose.yml segítségével."
echo "   Portainer → Stacks → Add stack → feltöltöd a docker-compose.yml fájlt → Deploy"
