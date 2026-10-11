import { Alert, Badge, Card } from "@/components/circo/primitives";
import { PageHeader } from "@/components/circo/page-elements";

function Command({ children }: { children: string }) {
  return <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-950 px-4 py-3 font-mono text-xs leading-6 text-zinc-100"><code>{children}</code></pre>;
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
    <span className="grid size-8 place-items-center rounded-full bg-zinc-950 text-xs font-semibold text-white">{number}</span>
    <div className="min-w-0 pt-1"><h3 className="text-sm font-semibold">{title}</h3><div className="mt-1 text-sm leading-6 text-zinc-500">{children}</div></div>
  </li>;
}

export function GuidePage() {
  return <div className="grid min-w-0 gap-8">
    <PageHeader eyebrow="Guide" title="Get Started" subtitle="Install project dependencies and start the Cyborg Lab web application on macOS or Windows." />
    <Alert tone="warning"><strong>Guide in development.</strong> This first version covers local installation and startup. Hardware setup and experiment tutorials will be added later.</Alert>

    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">macOS</h2><Badge>start.sh</Badge></div>
        <p className="mt-2 text-sm leading-6 text-zinc-500">The startup script creates `.venv`, installs Python and frontend packages when needed, starts both servers, and opens the browser.</p>
        <ol className="mt-6 grid gap-6">
          <Step number={1} title="Install system requirements">
            Install Python 3, Node.js 20.19 or newer, npm, and curl. Homebrew can install the main runtimes:
            <Command>brew install python node@20</Command>
          </Step>
          <Step number={2} title="Open the project directory">
            In Terminal, change to the extracted or cloned project folder:
            <Command>cd /path/to/Exp.-Recorder</Command>
          </Step>
          <Step number={3} title="Start Cyborg Lab">
            Make the script executable once, then run it:
            <Command>{`chmod +x start.sh
./start.sh`}</Command>
          </Step>
          <Step number={4} title="Open the application">
            The browser normally opens automatically. Otherwise visit `http://127.0.0.1:3001`. Press `Ctrl+C` in Terminal to stop both servers.
          </Step>
        </ol>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Windows</h2><Badge>start.bat</Badge></div>
        <p className="mt-2 text-sm leading-6 text-zinc-500">The Windows launcher checks Python and Node.js, installs missing runtimes through winget, creates `.venv-windows`, installs dependencies, and starts the app.</p>
        <ol className="mt-6 grid gap-6">
          <Step number={1} title="Prepare Windows">
            Use Windows 10 or 11 with Windows PowerShell and Windows Package Manager (`winget`). Internet access is required during the first setup.
          </Step>
          <Step number={2} title="Open the project directory">
            Extract or clone the repository. You can start it by double-clicking `start.bat`, or open PowerShell in the project folder.
          </Step>
          <Step number={3} title="Start Cyborg Lab">
            From PowerShell, run:
            <Command>.\start.bat</Command>
            The launcher handles the PowerShell execution policy for `start.ps1` automatically.
          </Step>
          <Step number={4} title="Open the application">
            The browser normally opens automatically. Otherwise visit `http://127.0.0.1:3001`. Close with `Ctrl+C` in the launcher window.
          </Step>
        </ol>
      </Card>
    </div>

    <Card>
      <h2 className="text-lg font-semibold">Useful startup options</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div><Badge>Simulation</Badge><p className="mt-2 text-sm text-zinc-500">Run without physical experiment hardware.</p><Command>./start.sh --mock</Command><Command>.\start.bat --mock</Command></div>
        <div><Badge>No browser</Badge><p className="mt-2 text-sm text-zinc-500">Start the servers without opening a browser automatically.</p><Command>./start.sh --no-open</Command><Command>.\start.bat --no-open</Command></div>
      </div>
    </Card>
  </div>;
}
