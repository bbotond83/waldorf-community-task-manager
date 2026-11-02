# Használati útmutató és kézi tesztlista

Ez az útmutató végigvezet a Waldorf közösségi feladatkezelő helyi próbaváltozatán. A program már valódi
adatbázissal működik: mindenki e-mail-címmel és jelszóval jelentkezik be, nincs többé „tesztprofil” kiválasztása. A
próbához **kitalált** adatokat töltünk be; valódi családok, gyerekek vagy elérhetőségek soha nem kerülnek ide.

Az útmutatót úgy írtuk, hogy programozói tudás nélkül is követhető legyen. Ahol parancsot kell begépelni, a
parancsot keretes blokkban találod: másold be a terminálba (Mac-en a „Terminál” alkalmazás), és nyomj Entert.

## 1. Előkészületek (egyszer kell)

1. Telepítsd a **Docker Desktop** programot, és indítsd el. Ez futtatja a helyi adatbázist. A programot a cégek
   mérettől függően csak fizetéssel használhatják: a telepítés előtt nézd meg, melyik díjszabás vonatkozik ránk.
2. Telepítsd a **Node.js 24**-et (az npm 11 vele jön). A pontos lépések az angol `README.md`-ben vannak.
3. A projekt mappájában futtasd egyszer: `npm ci`

## 2. A próbakörnyezet indítása

Minden próbanap elején, a projekt mappájában, **ebben a sorrendben**:

```bash
npm run db:start
set -a; . ./.env.database.local; set +a
export APP_SESSION_SECRET="$(openssl rand -hex 32)"
export APP_PUBLIC_URL="http://127.0.0.1:3000"
export SMTP_FROM="no-reply@example.test"
npm run db:seed
npm run dev
```

- `npm run db:start` elindítja a helyi adatbázist. Ha a program tűzfalról panaszkodik, kérd a fejlesztő segítségét;
  ezt a figyelmeztetést nem szabad megkerülni.
- `npm run db:seed` feltölti az adatbázist **kitalált** adatokkal (2 csoport, 6 család, az ő szüleik és gyerekeik,
  feladatok és események) és létrehozza a próbafiókokat. Ha már fel van töltve, nem változtat semmin.
- `npm run dev` elindítja a programot. A címe: **http://127.0.0.1:3000**. A terminált hagyd nyitva.

Az első oldal a **Biztonságos bejelentkezés**; innen a **Bejelentkezés** hivatkozás visz a belépéshez.

A kimenő leveleket (meghívó, jelszó-visszaállítás) a próbakörnyezet nem küldi el senkinek: a helyi „postafiókban”
olvashatod őket a **http://127.0.0.1:54324** címen.

## 3. Fiókok

Minden próbafiók címe `public.` kezdetű és `@example.test` végű. A jelszó szerepkörönként egy, kitalált próbajelszó;
a program nem írja ki őket. A négy jelszó a `scripts/db/seed/data.ts` fájlban van (a `SEED_PASSWORDS` részben):
nyisd meg egy szövegszerkesztővel, és keresd a szerepkör nevét.

| Fiók (e-mail-cím)                           | Szerepkör             | Mit lát?                                  |
| ------------------------------------------- | --------------------- | ----------------------------------------- |
| `public.parent-1@example.test` … `parent-6` | Szülő                 | A saját családja feladatai és értesítései |
| `public.teacher-1@example.test`             | Óvónő (csak olvasás)  | A Katica csoport beosztása                |
| `public.group-admin-1@example.test`         | Csoportadminisztrátor | A Katica csoport                          |
| `public.group-admin-2@example.test`         | Csoportadminisztrátor | A Süni csoport                            |
| `public.super-admin@example.test`           | Szuperadminisztrátor  | A teljes óvoda, import, beállítások       |

A családok: Szabó, Kiss, Horváth, Varga, Molnár, Németh. A Katica csoportba az 1., 3. és 5. család (Szabó, Horváth,
Molnár) tartozik, a Süni csoportba a 2., 4. és 6. A `parent-N` fiók az N-edik család szülője.

## 4. Bejelentkezés és kijelentkezés

1. Nyisd meg a **Bejelentkezés** oldalt, írd be az e-mail-címet és a jelszót, majd kattints a **Bejelentkezés**
   gombra. A sikeres belépés után a program rögtön a szerepköröd kezdőoldalára visz: szülőnél **Értesítések**,
   óvónőnél **Beosztás**, adminisztrátornál **Áttekintés**. Ugyanide jutsz, ha bejelentkezve nyitod meg a
   Bejelentkezés oldalt vagy a főoldalt. Nincs külön üdvözlő oldal.
2. Próbálj hibás jelszót beírni: **Hibás e-mail-cím vagy jelszó.** üzenetet kapsz. Öt egymás utáni hibás próbálkozás
   után a belépés egy időre zárolódik (**Túl sok sikertelen próbálkozás. Próbálja újra 15 perc múlva.**). A zárolás
   magától megszűnik.
3. A fejléc jobb oldalán lévő **Kijelentkezés** gombbal fejezheted be a munkamenetet. Kijelentkezés után a böngésző
   „Vissza” gombja sem mutat már védett tartalmat.
4. Ha olyan oldalt nyitsz meg, amelyhez a szerepkörödnek nincs joga (például szülőként az `/admin` címet),
   **Nincs jogosultság** üzenetet látsz, és egy hivatkozás visz a saját kezdőoldalra.

A menü minden oldalon ugyanaz, az éppen megnyitott oldal kiemelt gomb. A fejléc logójára kattintva mindig a
kezdőoldalra jutsz. Telefonon a **Navigáció** felirattal összecsukható a menü.

| Szerepkör             | Kezdőoldal  | Menü                                                                        |
| --------------------- | ----------- | --------------------------------------------------------------------------- |
| Szülő                 | Értesítések | Értesítések, Feladatok, Cserék                                              |
| Óvónő                 | Beosztás    | nincs menü, mert a Beosztás az egyetlen oldal                               |
| Csoportadminisztrátor | Áttekintés  | Áttekintés, Nyilvántartások, Feladatok és események, Jóváhagyások, Archívum |
| Szuperadminisztrátor  | Áttekintés  | az előbbi öt, majd Importálás, Emlékeztetők, Adatvédelem, Beállítások       |

## 5. Elfelejtett jelszó

1. A bejelentkezési oldalon kattints az **Elfelejtett jelszó** hivatkozásra.
2. Írd be egy próbafiók címét (például `public.parent-1@example.test`), majd kattints a **Hivatkozás kérése**
   gombra. A válasz mindig ugyanaz: **Ha az e-mail-cím ismert, elküldtük a jelszó-visszaállítási levelet.** Ez
   szándékos: ismeretlen címnél sem derül ki, hogy létezik-e a fiók. Próbáld ki egy nem létező címmel is.
3. Nyisd meg a helyi postafiókot (**http://127.0.0.1:54324**), és kattints a levélben lévő hivatkozásra.
4. Add meg az **Új jelszó**-t (legalább 8 karakter, legyen benne betű és szám), és mentsd el. Ezután az új jelszóval
   tudsz belépeni.
5. A hivatkozás **csak egyszer** használható. Ha másodszor nyitod meg, az oldal jelzi, hogy a hivatkozás már nem
   érvényes, és újat kérhetsz.

Figyelem: ha egy próbafiók jelszavát átállítod, az eredeti próbajelszó többé nem érvényes. Alaphelyzetbe állítás
(lásd a 10. pontot) után a fiókok újra az eredeti jelszóval jönnek létre.

## 6. Meghívó

A meghívóval egy új szülő vagy munkatárs hozza létre a saját fiókját: levelet kap egy hivatkozással, amely **7 napig
érvényes és csak egyszer használható**; a megnyíló **Meghívó elfogadása** oldalon megadja a nevét és a jelszavát.

Amit most kézzel ki lehet próbálni:

- Nyisd meg a `http://127.0.0.1:3000/meghivas/ismeretlen-hivatkozas` címet: a program általános üzenetet ad, hogy a
  hivatkozás nem érvényes, és nem árul el semmit arról, hogy létezett-e. Ugyanezt látod lejárt vagy már felhasznált
  hivatkozásnál.
- A hivatkozás oldalán a **Bejelentkezés** hivatkozás a belépéshez visz.

Fontos tudnivaló: **a meghívók elküldésére még nincs képernyő vagy parancs** az alkalmazásban; a meghívó létrehozása
és elfogadása a háttérben (programkódban) működik, és az automatikus tesztek végigpróbálják. Ezért egy teljes,
kézzel végigvihető meghívós próba most nem lehetséges; erről a hiányról külön jelentés szól (lásd
`verification/reports/u5-workbook-and-known-limits.md`).

## 7. Szülői felület

Jelentkezz be a `public.parent-1@example.test` fiókkal (a Szabó család). A kezdőoldal az **Értesítések**; az első
bejelentkezéskor még nincs értesítés (**Nincs értesítés.**).

### 7.1 Feladatok böngészése és jelentkezés

1. Nyisd meg a **Feladatok** oldalt. A Szabó családnak három feladat látszik: **Takarítás** és **Sütés** (ezeket a
   család már vállalta: **Vállalt feladat**), valamint a **Díszítés**, amelyre még lehet jelentkezni (**Jelentkezésre
   nyitott**; két helyből egy szabad). A **Takarítás** körülbelül egy hét múlva, a másik két feladat körülbelül tíz nap
   múlva van; a dátumokat a próbaadat a betöltés napjától számolja.
2. A **Szűrés** gomb melletti **Állapot** listával állapot szerint szűrhetsz. Az állapotszavak előtt kis jel áll (●
   Jelentkezésre nyitott, ■ Betelt, ⊘ Nem jogosult, ✓ Vállalt feladat, ◔ kérelem folyamatban); a jel csak
   díszítés, a szó mindig ott van.
3. Nyisd meg a **Díszítés** részleteit, és kattints a **Jelentkezem** gombra. Siker esetén visszajelzést kapsz;
   frissítés után a feladat már vállalt, és megjelenik a lemondási kérelem lehetősége.
4. Nyisd meg az **Értesítések** oldalt: a jelentkezésről értesítés érkezett (**Jelentkezés megerősítve: Díszítés**).

### 7.2 Értesítések

1. Kattints egy értesítés kártyájára, bárhová a kártyán: megnyílik a hozzá tartozó feladat, és az értesítés
   olvasottnak jelölődik. A menüben az **Értesítések** marad kiemelt, a visszalépő hivatkozás **Vissza az
   értesítésekhez** feliratú.
2. A kártyán lévő **Olvasottnak jelölöm** jelölőnégyzet bejelölése azonnal olvasottnak jelöli az értesítést; az
   olvasott kártya halványabb, az „Olvasott” felirattal, és a négyzete nem módosítható.
3. Az értesítések szövege magyar; a szolgáltatói állapotok helyben szimuláltak, valós kézbesítést nem igazolnak.

### 7.3 Csere és lemondás

1. Nyisd meg a **Sütés** feladatot (ezt a család már vállalta), és kattints a **Cserekérelem** hivatkozásra.
2. Válaszd ki a listából, melyik másik családi feladatra cserélnél, írj be egy kitalált indoklást, és küldd el
   (**Cserekérelem elküldése**). Választás nélkül a program nem küld el semmit, és kéri a választást.
3. A kérelem függő állapotú: a feladat oldalán **Cserekérelem folyamatban** jelzés áll, a **Cserekérelem** és a
   **Lemondási kérelem** hivatkozás eltűnik, ugyanaz a kérelem nem küldhető el újra. Az indoklás más családnak nem
   jelenik meg.
4. A **Cserék** oldalon látod a rád váró és az általad kért cseréket. A másik család a saját fiókjával **Megerősítés**
   vagy **Elutasítás** gombbal válaszol; a saját kérelmedet **Visszavonás** gombbal vonhatod vissza.
5. A **Lemondási kérelem** ugyanígy működik; ezt az adminisztrátor bírálja el (lásd 9. pont).
6. A **Saját megjegyzés mentése** mezőben a saját hozzájárulásodhoz írhatsz megjegyzést (például „Almalevet
   viszünk.”). Más család megjegyzését nem látod és nem módosíthatod.

### 7.4 Ami nem a tiéd

A másik csoport feladatát (például a Süni csoport Sütés feladatát) a szülő nem éri el: az oldal általános „nem
érhető el” üzenetet ad, és nem árul el róla semmit.

## 8. Óvónői, csak olvasási felület

Jelentkezz be a `public.teacher-1@example.test` fiókkal. A kezdőoldal a **Beosztás**; menü nincs, a részletek
oldalon és a tiltott oldalak üzenetén a **Vissza a beosztáshoz** hivatkozás, valamint a fejléc logója visszavisz.

1. Az oldal első megnyitásakor a szűrők üresek: a **Csoport** mezőben **Minden csoport** áll, a dátumok üresek, és a
   lista a három beosztási tételt mutatja. Az óvónő csak a neki kijelölt csoportot látja; a csoport neve a
   listában általános **Engedélyezett csoport** felirattal jelenik meg.
2. Adj meg kezdő és záró dátumot (például a mai naptól számított tizedik napot), és kattints a **Szűrés** gombra:
   csak az aznapi tételek maradnak. Csak az egyik dátum megadása is működik; ha a kezdő dátum későbbi a záró
   dátumnál, magyar hibaüzenetet kapsz.
3. Kattints egy tétel sorára vagy kártyájára (bárhová rajta): megnyílik a részletek oldal a felelős és a beosztott
   családokkal és az állapottal (**Nyitott**).
4. A **Szűrők törlése** gomb minden mezőt kiürít (a be nem küldött beírt értéket is), és a teljes listát mutatja.
5. Ellenőrizd, hogy az oldalon nincs módosító vagy jóváhagyó művelet, csak a **Kijelentkezés** gomb.

## 9. Adminisztrátori felületek

### 9.1 Csoportadminisztrátor

Jelentkezz be a `public.group-admin-1@example.test` fiókkal (Katica csoport). Az **Áttekintés** a függő jóváhagyások,
a nyilvántartások és a feladatok számát mutatja; a számokra kattintva a megfelelő listára jutsz.

1. A **Nyilvántartások** oldalon csak a Katica csoport családjai, gyerekei és a csoport látszik; a másik csoport
   (például a Kiss család) nem. Ha a másik csoport egy elemének címét közvetlenül próbálod megnyitni, **Nincs
   jogosultság** üzenetet kapsz.
2. Az **Új elem** gombbal új családot hozhatsz létre: válaszd ki a csoportot, add meg a család és a szülők nevét,
   e-mail-címét. Üres kötelező mezőnél magyar hibaüzenet jelenik meg a mező mellett.
3. A **Feladatok és események** oldalon nyisd meg a **Díszítés** feladatot. A **Hozzárendelés** résznél válassz
   családot és kattints a **Hozzárendelés** gombra. Ha a feladat betelt, a program a kapacitás elérését jelzi.
4. A **Jóváhagyások** lista akkor kap elemet, ha egy szülő lemondást vagy cserét kér (lásd 7.3). Nyisd meg a
   kérelmet, jelöld meg a **Döntés**-t, és kattints a **Döntés rögzítése** gombra; a szülő értesítést kap a
   döntésről.
5. A listák elemei egyetlen kattintható kártyák, az állapotok magyarul jelennek meg (Függőben, Jóváhagyva, Aktív,
   Archivált, Nyitott, Ütemezve). Minden listának a saját állapotait kínáló szűrője van; a **Szűrők törlése** gomb
   minden mezőt kiürít. Minden részletes oldalról **Vissza a …** hivatkozás visz a listához, a szűrő megtartásával.
6. A technikai részletek (verziószám) az oldalak alján az alapból összecsukott **Fejlesztői részletek** szakaszban
   vannak.
7. Az `/admin/import`, `/admin/emlekeztetok`, `/admin/adatvedelem` és `/admin/beallitasok` címet a csoportadminisztrátor
   nem érheti el, és a menüjében sem szerepelnek.

### 9.2 Szuperadminisztrátor

Jelentkezz be a `public.super-admin@example.test` fiókkal. A csoportadminisztrátori menüpontokon felül megjelenik az
**Importálás**, az **Emlékeztetők**, az **Adatvédelem** és a **Beállítások**.

- **Nyilvántartások és archívum.** Egy család az **Archiválás** gombbal az **Archívum**ba kerül, onnan a
  **Visszaállítás** gombbal hozható vissza.
- **Beállítások és jogosultságok.** Az **Emlékeztető-beállítások** résznél válassz másik engedélyezett **Címzetti kör**t,
  és mentsd el (**Beállítások mentése**). A **Szuperadminisztrátori jogosultságok** szakaszban minden fiók
  jogosultsága mellett ott a **Jogosultság visszavonása** gomb. Próbáld ki a `group-admin-1` jogosultságának
  visszavonását: az érintett személy a **következő kérésénél** már megtagadást kap (lásd 11. pont). Ezzel a próba
  adatot módosítottad; az alaphelyzetbe állítás visszahozza.
- **Emlékeztetők** és **Adatvédelem.** A két oldal az emlékeztetők állapotát és az adat-életciklus jelöltjeit
  mutatja; frissen betöltött adatnál üresek (**Nincs a szűrésnek megfelelő feladat.**, **Nincs életciklus-jelölt.**).
- **Importálás.** Az import egy Excel-munkafüzet (.xlsx) feltöltésével indul, majd hét lépésben halad: kiválasztás,
  ellenőrzés, előnézet, ütközések, megerősítés, mentés, eredmény. **Csak kitalált adatokat tartalmazó munkafüzetet
  tölts fel; a valódi szülői táblázatot soha.** Kitalált próbamunkafüzetet a fejlesztőtől kérhetsz; az automatikus
  tesztek az egész folyamatot (ütközések, megszakadt mentés, helyreállítás) végigpróbálják. A **Fejlesztői
  részletek** nem tartalmaznak választót: az import mindig a valódi feltöltött fájllal dolgozik.

## 10. Tesztadatok alaphelyzetbe állítása

Ha a próbák során módosítottál adatokat, a terminálban (a program futása közben egy másik ablakban) add ki:

```bash
npm run db:reset -- --yes
npm run db:seed
```

A `db:reset` kiüríti az adatbázist (a `--yes` kapcsoló kell hozzá: így nem törlődhet véletlenül a munkaadatod) és törli a próbafiókokat, a `db:seed` pedig újra létrehozza őket az eredeti
jelszóval. Ha a böngészőben közben be voltál jelentkezve, a korábbi munkamenet már nem érvényes: jelentkezz be
újra. A két parancs alapból azt az adatbázis-részt kezeli, amelyet az `npm run dev` is használ.

A nagy, 30 családos próbaadatot a `npm run db:seed:large` tölti be (előtte `npm run db:reset -- --yes`).

## 11. Több emberrel egyszerre

Egy böngésző egyszerre egy fiókot tud, mert a belépés süti a böngészőben él. Több ember (vagy több szerepkör) egy
időben történő próbájához minden szereplőnek **külön böngésző** vagy **külön privát ablak** kell (például Chrome,
Firefox és egy privát ablak). Ha ugyanabban a böngészőben másik fiókkal lépsz be, az előző kijelentkezik.

Ajánlott próbák:

1. **Két szülő ugyanarra az utolsó helyre jelentkezik.** A **Díszítés** feladatnak két helye van, ebből egy szabad.
   Az egyik böngészőben a `parent-1`, a másikban a `parent-3` fiókkal nyisd meg a **Díszítés** feladatot, és mindketten
   kattintsatok a **Jelentkezem** gombra körülbelül egy időben. Pontosan az egyiküké lesz a hely; a másik
   azt látja, hogy a feladat betelt, jelentkezési gomb nélkül.
2. **Csere két családdal.** A `parent-1` cserét kér a **Sütés** feladatra, a másik családé a választott partnerfeladat.
   A másik család fiókjával a **Cserék** oldalon **Megerősítés** vagy **Elutasítás** a válasz; mindkét család
   értesítést kap a döntésről.
3. **Lemondás és jóváhagyás.** A `parent-1` lemondási kérelmet küld; közben a `group-admin-1` böngészőjében a
   **Jóváhagyások** oldal frissítés után megmutatja a kérelmet. A **Döntés rögzítése** után a szülő értesítést kap.
4. **Jogosultság visszavonása közben.** A `group-admin-1` az egyik böngészőben az **Áttekintés** oldalon van. A
   szuperadminisztrátor egy másik böngészőben visszavonja a jogosultságát. Az első böngészőben a következő
   oldalbetöltésnél **Nincs jogosultság** jelenik meg, és a menü eltűnik.
5. **Jelszó-visszaállítás párhuzamosan.** Két böngészőben két különböző fiók kér visszaállítást: mindegyik a saját
   levelét kapja a helyi postafiókban, és a másik fiók belépése közben is működik.

## 12. Billentyűzetes és mobilpróba

- A **Tab** billentyűvel keresd meg az **Ugrás a fő tartalomra** hivatkozást; az **Enter** vigyen a fő tartalomra.
- Próbáld ki az oldalakat 200%-os nagyítással. Ne jelenjen meg levágott vagy vízszintes görgetésre kényszerítő
  tartalom. Keskeny (320 képpontos) képernyőn sem.
- Mobilnézetben (a böngésző fejlesztői eszközeiben telefon-méretre állítva) ellenőrizd a kártyás beosztáslistát és
  a fő gombok kényelmes érintési méretét (legalább 44 képpont).

## 13. Leállítás

A programot a terminálban **Ctrl+C**-vel állíthatod le. Az adatbázist a `npm run db:stop` állítja le; az adatok a
következő indításig megmaradnak.

## Tesztjegyzetek

| Próba                             | Elvárt eredmény                                                                                                | Eredmény / megjegyzés |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------- |
| Bejelentkezés és kijelentkezés    | Helyes jelszóval belép, hibással magyar hibaüzenet; kijelentkezés után a védett oldal nem látszik              |                       |
| Zárolás                           | Öt hibás próbálkozás után a zárolás üzenete, később újra lehet próbálni                                        |                       |
| Elfelejtett jelszó                | Mindig ugyanaz a válasz; a levél a helyi postafiókban van; a hivatkozás csak egyszer használható               |                       |
| Meghívó                           | Érvénytelen hivatkozásnál általános üzenet; a teljes folyamatot az automatikus tesztek végzik (nincs képernyő) |                       |
| Kezdőoldalak és menük             | Minden szerepkör a saját kezdőoldalát nyitja; a menü minden oldalon ugyanaz, az óvónőnek nincs menüje          |                       |
| Szülői jelentkezés                | A nyitott feladat vállalható, értesítés érkezik; a betelt feladat nem                                          |                       |
| Értesítések                       | A kártya megnyitja a feladatot és olvasottá teszi; a jelölőnégyzet azonnal olvasottá teszi                     |                       |
| Csere és lemondás                 | A kérelem függő, ugyanaz nem küldhető újra; a másik család megerősíthet vagy elutasíthat                       |                       |
| Óvónői beosztás                   | Szűrés és részletek működnek; nincs módosító művelet; az első megnyitás szűretlen                              |                       |
| Admin listák és szűrők            | Minden lista a saját állapotait kínálja; a Szűrők törlése mindent kiürít; a részletes oldalról van Vissza      |                       |
| Admin hozzárendelés és jóváhagyás | Betelt feladatnál kapacitásüzenet; a kérelem elbírálása értesítést ad a szülőnek                               |                       |
| Jogosultságok                     | Szülő, óvónő és csoportadmin nem éri el az importot, a beállításokat és az adatvédelmet; megtagadás üzenet     |                       |
| Jogosultság visszavonása          | A visszavont fiók a következő kérésnél megtagadást kap                                                         |                       |
| Több ember egyszerre              | Két szülő az utolsó helyre: egyiküké a hely; a másik a betelt állapotot látja                                  |                       |
| Alaphelyzet                       | A `db:reset` és `db:seed` után minden próbafiók az eredeti jelszóval és adatokkal újra elérhető                |                       |
| Billentyűzet / mobil              | Fókusz, nagyítás és mobil elrendezés használható, vízszintes görgetés nélkül                                   |                       |
