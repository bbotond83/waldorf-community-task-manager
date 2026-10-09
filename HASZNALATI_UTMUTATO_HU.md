# Használati útmutató és kézi tesztforgatókönyv

Ez az útmutató végigvezet a Waldorf közösségi feladatkezelő jelenlegi helyi
próbaalkalmazásán. A leírás a szülői, munkatársi és adminisztrátori
felületeket, valamint a főbb sikeres és elutasított műveleteket mutatja be.

## 1. A próbakörnyezet indítása

A fejlesztői kiszolgáló címe:

**http://127.0.0.1:3000**

Ha a kiszolgáló nem fut, a projekt könyvtárában indítsd el:

```bash
npm run dev
```

Elvárt kezdőképernyő: **Helyi tesztprofil kiválasztása**. A helyi futás
kizárólag kitalált adatokat használ; nem csatlakozik valódi Supabase,
e-mail-, Vercel- vagy más külső szolgáltatáshoz. A műveletek ezért csak
a helyi, memóriában tárolt tesztadatokra hatnak.

## 2. Tesztprofil kiválasztása és váltása

Válassz egy profilt a kezdőképernyőn: kattints a profil kártyájára (bárhol a
kártyán). A profil határozza meg, mely oldalakat látod és milyen műveleteket
végezhetsz.

| Profil | Mit ellenőrizhetsz? |
|---|---|
| **Szülő** | Egy kitalált család feladatai, jelentkezések és értesítések |
| **Óvónő (csak olvasás)** | A kijelölt csoport beosztása; módosítási művelet nélkül |
| **Csoportadminisztrátor** | A Boróka csoport áttekintése, nyilvántartásai, feladatai, jóváhagyásai és archívuma |
| **Szuperadminisztrátor** | Óvodai adminisztráció (importálás, emlékeztetők, adatvédelem, beállítások) és jogosultságkezelés |

A profil kiválasztása után nincs külön üdvözlő oldal: a program rögtön az
adott profil alapértelmezett oldalát nyitja meg.

| Profil | Alapértelmezett oldal | Menü (minden oldalon ugyanaz) |
|---|---|---|
| **Szülő** | Értesítések | Értesítések, Feladatok |
| **Óvónő** | Beosztás | nincs menü, mert a Beosztás az egyetlen oldal |
| **Csoportadminisztrátor** | Áttekintés | Áttekintés, Nyilvántartások, Feladatok és események, Jóváhagyások, Archívum |
| **Szuperadminisztrátor** | Áttekintés | az előbbi öt, majd Importálás, Emlékeztetők, Adatvédelem, Beállítások |

A menüpontok gombként jelennek meg; az éppen megnyitott oldal kiemelt
(sötétebb) gomb. Telefonon a **Navigáció** felirattal összecsukható a menü.
A fejléc logójára kattintva mindig a profil alapértelmezett oldalára jutsz
vissza.

Másik szerepkör kipróbálásához kattints a felső sávban a
**Tesztprofil váltása** gombra, majd válassz új profilt. Ez a munkamenetet
váltja; a módosított szintetikus adatokat külön kell alaphelyzetbe állítani.

## 3. Szülői felület

Válaszd a **Szülő** profilt. A program az **Értesítések** oldalt nyitja meg;
a menüben az **Értesítések** és a **Feladatok** gomb jelenik meg (ebben a sorrendben).

### 3.1 Feladatok böngészése és jelentkezés

1. Nyisd meg a **Feladatok** oldalt.
2. Ellenőrizd a tesztlistában a különböző állapotokat:
   - **Kerti előkészítés** – nyitott jelentkezés.
   - **Őszi vásár előkészítése** – betelt.
   - **Hétköznapi udvarrendezés** – ehhez a család nem jogosult.
   - **Lámpás ünnep előkészítése** – már vállalt feladat.
3. Nyisd meg a **Kerti előkészítés** részleteit, majd kattints a
   **Jelentkezem** gombra.
4. Ellenőrizd a sikeres visszajelzést. Frissítés után a feladat már vállalt
   állapotú; megjelenik a lemondási kérelem lehetősége.
5. Nyisd meg a betelt és a nem jogosult feladatot is. Mindkettőnél jelenjen
   meg az állapot magyarázata, jelentkezési gomb nélkül.

### 3.2 Vállalt feladat, csere és lemondás

1. Nyisd meg a **Lámpás ünnep előkészítése** feladatot.
2. A **Saját hozzájárulási megjegyzés** mezőben módosítsd például az
   „Almalevet viszünk.” szöveget, majd mentsd el.
3. Próbáld ki a **Cserekérelem** oldalt: írj be egy kitalált indoklást, és
   küldd el a kérelmet.
4. Ellenőrizd a sikeres, függő állapotú visszajelzést. Az indoklás a
   visszaigazolásban és a többi család számára nem jelenik meg.
5. Térj vissza a feladathoz: a feladat oldalán megjelenik a **Cserekérelem
   folyamatban** jelzés, a **Cserekérelem** és a **Lemondási kérelem**
   hivatkozás pedig eltűnik, amíg a kérelem függőben van. Ugyanazt a kérelmet
   nem lehet újra elküldeni; a kérelem oldala a jelzést és a feladathoz
   visszavivő hivatkozást mutatja az űrlap helyett.
6. Egy másik, még nem kérelmezett feladaton próbáld ki a **Lemondási
   kérelem** oldalt is. Az indoklás legyen tesztszöveg, ne valódi személyes
   adat.

### 3.3 Értesítések és meghívóállapotok

1. Nyisd meg az **Értesítések** oldalt (ez a szülő alapértelmezett oldala).
2. Kattints egy értesítés kártyájára, bárhová a kártyán: megnyílik a
   hozzá tartozó feladat, és az értesítés olvasottnak jelölődik. Külön
   „Megnyitás” hivatkozás nincs. A menüben az **Értesítések** marad kiemelt,
   a visszalépő hivatkozás pedig **Vissza az értesítésekhez** feliratú, és az
   értesítések listájára visz. A listán az olvasott értesítés kártyája
   szürkített (halványabb szöveg és háttér), az „Olvasott” felirattal.
3. A kártya jobb oldalán lévő **Olvasottnak jelölöm** jelölőnégyzet
   bejelölése azonnal olvasottnak jelöli az értesítést. Az olvasott
   értesítés négyzete bejelölt és nem módosítható. Hiba esetén a négyzet
   visszaáll, és rövid magyar hibaüzenet jelenik meg a kártyán.
   JavaScript nélkül a négyzet mellett megjelenő **Mentés** gombbal
   küldhető el a jelölés.
4. A következő címekkel kipróbálhatod a meghívóoldal különböző állapotait:
   - `/meghivas/parent-valid-invitation`
   - `/meghivas/parent-expired-invitation`
   - `/meghivas/parent-used-invitation`
   - `/meghivas/not-a-known-token`
5. A belépési oldal biztonságos folytatási útvonallal:
   `/belepes?tovabb=/szulo/ertesitesek`

## 4. Munkatársi, csak olvasási felület

Válaszd a **Óvónő** profilt. A program a **Beosztás** oldalt nyitja meg.
Menü nincs, mert ez az egyetlen oldal; a részletek oldalon és a tiltott
oldalak üzenetén a **Vissza a beosztáshoz** hivatkozás, valamint a fejléc
logója visszavisz ide.

1. Ellenőrizd a Tölgyfa csoport beosztását.
2. Állítsd a kezdő és záró dátumot egyaránt **2026-08-14** értékre, majd
   kattints a **Szűrés** gombra. A találatok között meg kell jelennie a
   **Kézműves előkészítés** tevékenységnek.
3. Kattints egy beosztási tétel sorára vagy kártyájára (bárhová rajta) a
   részletek megnyitásához, majd térj vissza. A dátumszűrők maradjanak meg.
4. Próbálj olyan dátumtartományt megadni, amelyre nincs találat; ellenőrizd
   az üres állapotot és a **Szűrők törlése** linket.
5. Ellenőrizd, hogy az oldalon nincs feladatmódosító vagy jóváhagyó művelet,
   és a profilváltón kívül nem jelenik meg szerkesztési lehetőség.

Opcionális jogosultsági próba: nyisd meg közvetlenül ezt a címet:

```text
/munkatars/beosztas?csoport=group-ungranted&kezdet=2026-08-12&veg=2026-08-20
```

A nem engedélyezett csoport adatai helyett általános hozzáférés-megtagadást
kell kapnod.

## 5. Csoportadminisztrátori felület

Válaszd a **Csoportadminisztrátor** profilt. A program az **Áttekintés**
oldalt nyitja meg; a menüben az **Áttekintés**, **Nyilvántartások**,
**Feladatok és események**, **Jóváhagyások** és **Archívum** gomb látszik.
A listák elemei egyetlen kattintható kártyák (nincs külön „Részletek”
hivatkozás), az állapotok magyarul jelennek meg (Függőben, Jóváhagyva,
Aktív, Archivált, Nyitott, Ütemezve). Minden listának a saját állapotait
kínáló szűrője van (jóváhagyásoknál Függőben, Jóváhagyva, Elutasítva;
nyilvántartásoknál Aktív, Archivált; feladatoknál Nyitott, Ütemezve). Minden
részletes oldalon és az **Új rekord**, valamint az **Új feladat vagy
esemény** űrlapon **Vissza a …** hivatkozás visz a megfelelő listához, a
szűrő megtartásával. Az üres kötelező mező beküldésekor magyar hibaüzenet
jelenik meg a mező mellett.

A technikai részletek (a kapacitási és egyéb forgatókönyv-választók, a
„Verzió” és a „Korreláció” sor) az oldalak alján az alapból összecsukott
**Fejlesztői részletek** szakaszban találhatók; a próbákhoz nyisd ki.

1. Az áttekintő oldalon jegyezd fel a függő jóváhagyások számát.
2. Nyisd meg a feladatokat, szűrj vagy keress rá a
   **Kerti előkészületek** feladatra.
3. A részleteknél próbáld ki a hozzárendelést. A **Fejlesztői részletek**
   alatt a **Betelt kapacitás** forgatókönyvvel ellenőrizd az ütközési
   visszajelzést; ezután próbáld ki a jogosult, szabad kapacitású
   forgatókönyvet.
4. Nyisd meg a **Jóváhagyások** listát. Válassz egy függő feladatcsere- vagy
   lemondási kérelmet, jelöld meg a döntést, majd rögzítsd.
5. Opcionális: közvetlenül próbáld megnyitni az `/admin/import`,
   `/admin/emlekeztetok`, `/admin/adatvedelem` vagy `/admin/beallitasok`
   címet. A csoportadminisztrátor ezekhez nem férhet hozzá, és a menüjében
   sem szerepelnek.

## 6. Szuperadminisztrátori felület

Válaszd a **Szuperadminisztrátor** profilt. A csoportadminisztrátori
menüpontokon felül a következők jelennek meg: **Importálás**,
**Emlékeztetők**, **Adatvédelem** és **Beállítások**.

### 6.1 Nyilvántartás és feladat

- A **Nyilvántartások** oldalon keress rá a **Fenyő család** vagy a
  **Boróka csoport** rekordra. Nyiss meg egy rekordot, módosítsd a
  megnevezését, majd mentsd el. Rekordot archiválni, illetve az archívumból
  visszaállítani is lehet.
- A **Feladatok** oldalon nyiss meg egy feladatot. Módosítsd a
  megnevezését, próbáld ki a hozzárendelést, majd teszteld a betelt vagy
  nem jogosult állapotot.

### 6.2 Szintetikus Excel-import

1. Nyisd meg az **Importálás** oldalt.
2. Hagyd kiválasztva a **Waldorf 30 család — v1** szintetikus munkafüzetet
   és az **Érvényes** forgatókönyvet (a forgatókönyv-választók az oldal alján,
   a **Fejlesztői részletek** szakaszban vannak; a mentési forgatókönyv
   ugyanott módosítható).
3. Kattints az **Ellenőrzés és előnézet** gombra. Ellenőrizd a sorok számát,
   az ujjlenyomatot és a változásösszesítőt.
4. Az ütközésnél válaszd a **Meglévő adat megtartása** vagy az
   **Importált adat használata** lehetőséget, majd kattints az
   **Ütközés feloldása** gombra.
5. Jelöld be a következmények megerősítését, hagyd a mentési forgatókönyvet
   **Sikeres** értéken, és kattints az **Import véglegesítése** gombra.
6. Elvárt eredmény: **3 rekord módosult, 1 sor változatlan maradt**.

Ez a próba nem tölt fel valódi munkafüzetet és nem ír éles adatbázisba.
Külön próbához választható a hibás fájl, túl nagy fájl, hiányzó munkalap,
hiányzó oszlop vagy megszakított mentés forgatókönyve. Megszakítás után
használd a **Helyreállítás folytatása** gombot.

### 6.3 Emlékeztetők és adatvédelem

- Az **Emlékeztetők felügyelete** oldalon keresd meg a Lámpás ünnep
  újrapróbálható értesítését. Kattints az **Újrapróbálás** gombra, majd
  ellenőrizd az állapotot. Az elküldött vagy elavult emlékeztető nem
  újrapróbálható.
- Az **Adat-életciklus** oldalon ellenőrizd a távozott családok
  jelöltjeit. A megőrzési kötelezettséggel blokkolt rekordnál ne legyen
  végrehajtható törlési művelet. A többi művelet csak helyi próbaadatot érint.
- A **Beállítások és jogosultságok** oldalon válassz másik engedélyezett
  címzetti kört, majd mentsd el az emlékeztető-beállítást. A képernyőn
  szereplő kézbesítés szimulált.

## 7. Szuperadminisztrátori próba

Válaszd a **Szuperadminisztrátor** profilt, majd nyisd meg a
**Beállítások és jogosultságok** oldalt. A szuperadminisztrátori
jogosultságok szakaszban:

1. Próbáld meg visszavonni a saját hozzáférést; a rendszernek ezt meg kell
   akadályoznia.
2. Válaszd a kijelölt csoportadminisztrátori jogosultság szabályos
   visszavonását.
3. Válts át a **Csoportadminisztrátor** profilra. A következő kérésnél
   hozzáférés-megtagadást kell kapnod.

Ez szándékosan módosítja a helyi tesztadatot. Alaphelyzetbe állítás után
az eredeti szerepkörök visszaállnak.

## 8. Billentyűzetes és mobilpróba

- A **Tab** billentyűvel keresd meg az **Ugrás a fő tartalomra** linket;
  az **Enter** vigyen a fő tartalomra.
- Próbáld ki az oldalakat 200%-os nagyítással. Ne jelenjen meg levágott
  vagy vízszintes görgetésre kényszerülő tartalom.
- Mobilnézetben ellenőrizd a kártyás beosztáslistát és a fő műveleti
  gombok kényelmes érintési méretét.

## 9. Tesztadatok alaphelyzetbe állítása

Ha a próbák során módosítottad a feladatokat, értesítéseket, importot vagy
jogosultságokat, az alábbi parancs visszaállítja a szintetikus
memóriaállapotot:

```bash
curl -X POST http://127.0.0.1:3000/api/synthetic/reset \
  -H 'Origin: http://127.0.0.1:3000'
```

Siker esetén a válaszban `SYNTHETIC_FIXTURE_RESET` és
`waldorf-local-v1` szerepel. A kiválasztott profil munkamenete megmarad;
szerepkörváltáshoz használd a **Tesztprofil váltása** gombot. A fejlesztői
kiszolgálót a terminálban **Ctrl+C** billentyűkombinációval állíthatod le.

## Tesztjegyzetek

| Próba | Elvárt eredmény | Eredmény / megjegyzés |
|---|---|---|
| Profilok és navigáció | Minden profil az alapértelmezett oldalát nyitja; a menü minden oldalon ugyanaz, az aktuális oldal kiemelt; az óvónőnek nincs menüje | |
| Listaelemek és állapotok | Minden listaelem egyetlen kattintható kártya; az állapotok magyarul látszanak | |
| Értesítés olvasottnak jelölése | A négyzet bejelölése azonnal olvasottá teszi; az olvasott négyzet bejelölt és nem módosítható; az olvasott kártya szürkített | |
| Értesítés megnyitása | A kártya megnyitja a feladatot, a menüben az Értesítések marad kiemelt, a „Vissza az értesítésekhez” hivatkozás a listára visz, és az értesítés olvasott lesz | |
| Függő kérelem | Elküldés után megjelenik a függő jelzés; a kérelem hivatkozásai eltűnnek, ugyanaz nem küldhető újra | |
| Admin visszalépés és szűrők | Minden részletes oldalon és űrlapon van Vissza hivatkozás; a szűrők csak az adott listára érvényes állapotokat kínálják | |
| Technikai szövegek | Verzió, Korreláció és forgatókönyv-választók csak a Fejlesztői részletek szakaszban látszanak | |
| Szülői jelentkezés | Nyitott feladat vállalható; betelt/nem jogosult feladat nem | |
| Csere és lemondás | Kérelem elküldése sikeres, az indoklás nem jelenik meg más nézetben | |
| Munkatársi beosztás | Szűrés és részletek működnek; nincs módosító művelet | |
| Adminisztrátori jogosultságok | Korlátozott profilnál a tiltott oldal megtagadott | |
| Import és helyreállítás | Előnézet, ütközésfeloldás és eredmény vagy helyreállítás látható | |
| Emlékeztető és beállítás | Újrapróbálás és címzetti beállítás szimulált állapotot mutat | |
| Billentyűzet / mobil | Fókusz, nagyítás és mobil elrendezés használható | |
