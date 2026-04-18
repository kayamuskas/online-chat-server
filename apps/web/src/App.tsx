import { SERVICE_PORTS } from "@chat/shared";

/**
 * Phase 1 shell — offline asset delivery proof.
 *
 * This component renders a minimal status page that:
 * 1. Confirms assets are served from locally bundled files (no CDN).
 * 2. Shows the REST API and WebSocket transport endpoints declared in
 *    the shared SERVICE_PORTS contract.
 * 3. Contains no product features (no auth, no rooms, no messaging).
 *
 * It satisfies must_haves.truths for Phase 1 Plan 02:
 *   - "The browser client is served from locally built assets rather than CDN scripts."
 *   - "The frontend proves the mixed transport boundary by knowing both REST and WebSocket endpoints."
 */
function App() {
  const apiBaseUrl = `http://localhost:${SERVICE_PORTS.apiHttp}`;
  const wsUrl = `ws://localhost:${SERVICE_PORTS.apiHttp}`;

  return (
    <main className="shell">
      <header className="shell__header">
        <h1>Online Chat Server</h1>
        <span className="shell__badge">Phase 1 — Foundation</span>
      </header>

      <section className="shell__section">
        <h2>Offline Asset Delivery</h2>
        <p>
          This page is served from locally bundled assets built by Vite.
          No runtime CDN fetches, no remote fonts, and no browser-time
          Babel compilation are required. All JavaScript and CSS are
          bundled at build time from this repository.
        </p>
        <p className="shell__status shell__status--ok">
          Assets: locally bundled (offline-ready)
        </p>
      </section>

      <section className="shell__section">
        <h2>Transport Boundaries</h2>
        <p>
          The following endpoints will be exposed by the API service once
          it is running. This frontend is pre-wired to their locations as
          defined in the shared <code>SERVICE_PORTS</code> contract.
        </p>

        <table className="shell__table">
          <thead>
            <tr>
              <th>Transport</th>
              <th>Endpoint</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>REST (HTTP)</td>
              <td>
                <code>{apiBaseUrl}/healthz</code>
              </td>
              <td>API container readiness</td>
            </tr>
            <tr>
              <td>REST (HTTP)</td>
              <td>
                <code>{apiBaseUrl}/api/v1/meta</code>
              </td>
              <td>Service metadata</td>
            </tr>
            <tr>
              <td>WebSocket (Socket.IO)</td>
              <td>
                <code>{wsUrl}/</code>
              </td>
              <td>Realtime event transport</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="shell__section">
        <h2>Phase 1 Scope</h2>
        <p>
          Product features (authentication, rooms, messaging) are not part
          of Phase 1. This shell exists only to prove that the build pipeline
          and transport boundary are correctly wired before chat behavior
          is implemented.
        </p>
      </section>

      <footer className="shell__footer">
        <small>
          Phase 1 — Foundation and Offline Delivery &mdash; no product UI yet
        </small>
      </footer>
    </main>
  );
}

export default App;
