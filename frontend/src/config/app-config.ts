const appName = "Cyborg Lab";

export const appConfig = {
  name: appName,
  icon: "/bug-icon.svg",
  tagline: "Local control plane",
  description: "Experimental recording and stimulation control console",
  metadata: {
    title: `${appName} · Lab Console`,
  },
  software: {
    pageTitle: "Software",
    pageSubtitle: "View the software components used by the experiment system.",
    components: [
      { name: "Web Console", value: "Next.js" },
      { name: "Experiment API", value: "FastAPI" },
      { name: "Data Storage", value: "SQLite" },
    ],
    runtime: ["SQLite", "SCPI", "USB Serial"],
  },
} as const;
