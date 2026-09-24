import type { SyntheticProfile } from "./synthetic/profiles.ts";

export function ProfileSelector({ profiles }: { profiles: readonly SyntheticProfile[] }) {
  return (
    <main id="fo-tartalom" className="selector-page" data-testid="profile-selector">
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
          <article className="profile-card" key={profile.id}>
            <h2>{profile.label}</h2>
            <p>{profile.scopeSummary}</p>
            <form
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
              <button type="submit" data-testid={`profile-selector-${profile.id}-button`}>
                Profil használata
              </button>
            </form>
          </article>
        ))}
      </div>
    </main>
  );
}
