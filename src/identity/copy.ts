/**
 * All Hungarian text of the identity screens and mails (NFR5.3, NFR8.1). Identifiers elsewhere are
 * English; this module is the only place the screen copy lives. Fixed wording comes from
 * frontend-components.md of the design.
 */
export const COPY = {
  signIn: {
    title: "Bejelentkezés",
    heading: "Bejelentkezés",
    emailLabel: "E-mail-cím",
    passwordLabel: "Jelszó",
    submit: "Bejelentkezés",
    pending: "Bejelentkezés folyamatban…",
    forgotLink: "Elfelejtett jelszó",
    signedInHeading: "Be van jelentkezve",
    signedInMessage:
      "A bejelentkezés sikerült. A kijelentkezés gombbal fejezheti be a munkamenetet.",
    invalid: "Hibás e-mail-cím vagy jelszó.",
    locked: "Túl sok sikertelen próbálkozás. Próbálja újra 15 perc múlva.",
    temporary: "Átmeneti hiba történt. Próbálja újra.",
    emailRequired: "Adja meg az e-mail-címet.",
    passwordRequired: "Adja meg a jelszót.",
  },
  signOut: {
    label: "Kijelentkezés",
    pending: "Kijelentkezés folyamatban…",
  },
  reset: {
    requestTitle: "Jelszó-visszaállítás",
    requestHeading: "Jelszó-visszaállítás",
    requestIntro: "Adja meg az e-mail-címét, és elküldjük a jelszó-visszaállítási hivatkozást.",
    emailLabel: "E-mail-cím",
    requestSubmit: "Hivatkozás kérése",
    requestPending: "Küldés folyamatban…",
    confirmation: "Ha az e-mail-cím ismert, elküldtük a jelszó-visszaállítási levelet.",
    emailInvalid: "Adjon meg érvényes e-mail-címet.",
    backToSignIn: "Vissza a bejelentkezéshez",
    newTitle: "Új jelszó megadása",
    newHeading: "Új jelszó megadása",
    newPasswordLabel: "Új jelszó",
    newSubmit: "Jelszó mentése",
    newPending: "Mentés folyamatban…",
    notValid: "Ez a hivatkozás már nem érvényes. Kérjen újat.",
    requestNewLink: "Új hivatkozás kérése",
  },
  invitation: {
    title: "Meghívó elfogadása",
    heading: "Meghívó elfogadása",
    notValidTitle: "A meghívó nem érvényes",
    notValid: "Ez a meghívó már nem érvényes. Kérjen újat a csoport adminisztrátorától.",
    passwordLabel: "Jelszó",
    submit: "Fiók létrehozása",
    pending: "Fiók létrehozása folyamatban…",
    roleLabel: "Szerepkör",
    scopeLabel: "Hatókör",
    roles: {
      parent: "Szülő",
      kindergarten_teacher: "Óvodapedagógus",
      group_admin: "Csoportadminisztrátor",
      super_admin: "Szuperadminisztrátor",
    } as Readonly<Record<string, string>>,
    scopes: {
      family: "Család",
      group: "Csoport",
      organization: "Szervezet",
    } as Readonly<Record<string, string>>,
  },
  password: {
    rule: "legalább 8, legfeljebb 72 karakter, legalább egy betű és egy szám",
    ruleError:
      "A jelszó legalább 8 és legfeljebb 72 karakter legyen, és tartalmazzon betűt és számot.",
    hint: "A jelszó követelménye: legalább 8, legfeljebb 72 karakter, legalább egy betű és egy szám.",
    rejectedNewLink:
      "Ezt a jelszót a rendszer nem fogadta el. A hivatkozás egyszer használható volt, ezért kérjen új jelszó-visszaállítási hivatkozást.",
  },
  common: {
    skipLink: "Ugrás a fő tartalomra",
    temporary: "Átmeneti hiba történt. Próbálja újra.",
    rateLimited:
      "Túl sok próbálkozás érkezett rövid idő alatt. Kérjük, várjon néhány percet, majd próbálja újra.",
    accessDenied: "Ehhez az adathoz nincs jogosultsága.",
  },
  mail: {
    invitationSubject: "Meghívó a Waldorf közösségi feladatkezelőbe",
    invitationGreeting: "Üdvözöljük!",
    invitationBody:
      "Meghívást kapott a Waldorf közösségi feladatkezelőbe. Az alábbi hivatkozáson hozhatja létre a fiókját:",
    invitationLinkLabel: "Fiók létrehozása",
    invitationValidity: "A hivatkozás 7 napig érvényes, és csak egyszer használható.",
    invitationIgnore: "Ha nem várta ezt a levelet, hagyja figyelmen kívül.",
  },
} as const;
