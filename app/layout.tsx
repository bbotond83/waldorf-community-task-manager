import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./globals.css";

// Self-hosted variable fonts (files in app/fonts, licences beside them): Vollkorn for headings, Karla for text.
// Each family is split in two files, and the browser fetches a file only when a character on the page needs it:
// "latin" holds basic Latin, "latin-ext" holds the Hungarian letters ő and ű. The unicode-range of each file is the
// same as the one the font's publisher uses. (The values are written out in each call because Next.js reads them at
// build time and cannot follow a constant.) A system serif or sans-serif shows while a font loads (display: swap); it
// is named in --font-heading and --font-body in globals.css, after both files of the family. Do not add a `fallback`
// here and keep adjustFontFallback off: Next.js would put its own stand-in font into each file's family name, ahead of
// the latin-ext file, and the browser would draw ő and ű with that system font instead of Vollkorn or Karla.

const vollkornLatin = localFont({
  src: "./fonts/vollkorn-latin-wght-normal.woff2",
  weight: "400 900",
  style: "normal",
  display: "swap",
  variable: "--font-vollkorn-latin",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
  adjustFontFallback: false,
});
const vollkornLatinExt = localFont({
  src: "./fonts/vollkorn-latin-ext-wght-normal.woff2",
  weight: "400 900",
  style: "normal",
  display: "swap",
  variable: "--font-vollkorn-latin-ext",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
  adjustFontFallback: false,
});
const karlaLatin = localFont({
  src: "./fonts/karla-latin-wght-normal.woff2",
  weight: "200 800",
  style: "normal",
  display: "swap",
  variable: "--font-karla-latin",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
  adjustFontFallback: false,
});
const karlaLatinExt = localFont({
  src: "./fonts/karla-latin-ext-wght-normal.woff2",
  weight: "200 800",
  style: "normal",
  display: "swap",
  variable: "--font-karla-latin-ext",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
  adjustFontFallback: false,
});

const fontClasses = [vollkornLatin, vollkornLatinExt, karlaLatin, karlaLatinExt]
  .map((font) => font.variable)
  .join(" ");

export const metadata: Metadata = {
  title: "Waldorf közösségi feladatkezelő",
  description: "Helyileg futtatható, szerepkör-alapú közösségi feladatkezelő.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="hu" className={fontClasses}>
      <body>{children}</body>
    </html>
  );
}
