# Telefonkönyv V0.01 – Telepítési útmutató
## GitHub + Portainer (SSH nélkül, bárki megcsinálhatja)

---

## Áttekintés

```
GitHub repó  →  Portainer "Stack from Git"  →  NAS-on fut az alkalmazás
```

A Portainer letölti a kódot a GitHub-ról, maga buildeli, és elindítja.
**Nem kell SSH, nem kell parancssor.**

---

## 1. lépés – GitHub repó létrehozása

1. Menj a **github.com** oldalra → regisztrálj vagy lépj be
2. Kattints a **"+"** gombra (jobb felső sarok) → **"New repository"**
3. Töltsd ki:
   - **Repository name:** `telefonkonyv`
   - **Visibility:** `Public` *(a privát repóhoz token kell, lásd lent)*
   - **Initialize:** pipálj be egy README-t (hogy ne legyen üres)
4. Kattints **"Create repository"**

---

## 2. lépés – Fájlok feltöltése GitHub-ra

1. A létrehozott repó oldalán kattints az **"uploading an existing file"** linkre
   *(vagy: Add file → Upload files)*

2. **Húzd be az egész `telefonkonyv_docker` mappát** a feltöltési területre
   (a GitHub web UI megőrzi a mappastruktúrát)

3. Kattints **"Commit changes"** → **"Commit directly to the main branch"**

4. Ellenőrzés: a repóban látszódjon ez a struktúra:
   ```
   Dockerfile
   docker-compose.yml
   package.json
   server.js
   build.sh
   client/
     package.json
     vite.config.js
     index.html
     src/
       main.jsx
       App.jsx
   ```

5. Másold ki a repó URL-jét, pl.:
   ```
   https://github.com/felhasznalonev/telefonkonyv
   ```

---

## 3. lépés – Portainer Stack telepítés

1. Portainer megnyitása: `http://<nas-ip>:9000`
2. Bal menü → **Stacks → Add stack**
3. **Name:** `telefonkonyv`
4. **Build method:** válaszd a **"Repository"** opciót
5. Töltsd ki:
   - **Repository URL:** `https://github.com/felhasznalonev/telefonkonyv`
   - **Repository reference:** `refs/heads/main`
   - **Compose path:** `docker-compose.yml`
6. **Environment variables** résznél kattints **"Add environment variable"**:
   ```
   Name:  JWT_SECRET
   Value: valami-hosszu-titkos-szoveg-amit-te-valasztasz
   ```
7. Kattints **"Deploy the stack"**

> ⏳ Az első build **5-10 percig** tarthat – a Portainer letölti és fordítja a kódot.
> Türelmesen várd meg, ne kattints el!

---

## Elérhetőség

```
http://<nas-ip>:3000
```

---

## Alapértelmezett bejelentkezési adatok

| Felhasználónév | Jelszó    | Szerepkör |
|----------------|-----------|-----------|
| `admin`        | `admin123`| Főadmin   |

**⚠️ Az első belépés után azonnal változtasd meg a jelszót!**
Admin felület → 👥 Felhasználók → Szerkesztés

---

## Frissítés (új verzió telepítése)

1. Töltsd fel az új fájlokat a GitHub repóba (az előző fájlokat felülírva)
2. Portainerben: **Stacks → telefonkonyv → Editor → Update the stack**
3. Az adatbázis (volume) megmarad, nem vész el semmi

---

## Privát GitHub repó (opcionális)

Ha nem szeretnéd hogy a kód nyilvános legyen:

1. A repót hozd létre **Private**-ként
2. GitHub-on: **Settings → Developer settings → Personal access tokens → Tokens (classic)**
3. **Generate new token** → pipálj be: `repo` → **Generate token**
4. A tokent másold ki (csak egyszer látható!)
5. Portainerben a Repository beállításoknál kapcsold be az **"Authentication"**-t:
   - **Username:** GitHub felhasználóneved
   - **Password:** a generált token

---

## Adatbázis backup

```
Portainer → Volumes → telefonkonyv_data → Browse
```
Innen le tudod tölteni a `telefonkonyv.db` fájlt.

Vagy SSH-val (ha mégis elérhető):
```bash
docker cp telefonkonyv:/app/data/telefonkonyv.db ./backup.db
```

---

## Hibaelhárítás

**Build sokáig tart / lefagy:**
→ Normális, az első build 5-10 perc. Portainer → Stacks → telefonkonyv → Logs-ban követheted.

**"repository not found" hiba:**
→ Ellenőrizd az URL-t. Privát repónál add meg az authentikációt.

**Nem érhető el a 3000-es port:**
→ DSM → Vezérlőpult → Biztonság → Tűzfal → 3000-es port engedélyezése

**Logok megtekintése Portainerben:**
→ Containers → telefonkonyv → Logs

---

*Telefonkönyv V0.01 | by Dark*
