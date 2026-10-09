import Image from "next/image";
import { BrandMark } from "./BrandMark.tsx";
import { withSyllableBreaks } from "./hyphenation.ts";
import type { SyntheticProfile } from "./synthetic/profiles.ts";

export function ProfileSelector({ profiles }: { profiles: readonly SyntheticProfile[] }) {
  return (
    <main id="fo-tartalom" className="selector-page" data-testid="profile-selector">
      <div className="selector-hero" data-testid="selector-hero">
        <Image
          className="selector-cover"
          src="/brand/cover.jpg"
          alt=""
          fill
          sizes="(max-width: 72rem) 100vw, 1152px"
          priority
        />
        <BrandMark linked={false} size={72} />
      </div>
      <div className="selector-heading">
        <p className="eyebrow">Kizárólag kitalált helyi adatok</p>
        <h1>Helyi tesztprofil kiválasztása</h1>
        <p>
          Válassz szerepkört a jogosultsági és navigációs határok ellenőrzéséhez. Ez a környezet nem
          kapcsolódik éles szolgáltatáshoz.
        </p>
      </div>
      <div className="profile-grid">
        {profiles.map((profile) => (
          <form
            key={profile.id}
            action="/api/synthetic/session"
            method="post"
            data-testid={`profile-selector-${profile.id}-form`}
          >
            <input
              type="hidden"
              name="profileId"
              value={profile.id}
              data-testid={`profile-selector-${profile.id}-input`}
            />
            <button
              type="submit"
              className="profile-card"
              aria-label={`${profile.label}. ${profile.scopeSummary}`}
              data-testid={`profile-selector-${profile.id}-button`}
            >
              <span className="profile-card-name">{withSyllableBreaks(profile.label)}</span>
              <span className="profile-card-summary">{profile.scopeSummary}</span>
            </button>
          </form>
        ))}
      </div>
    </main>
  );
}
