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
    pageSubtitle: "Manage source projects, program versions, and firmware flashing.",
    runtime: ["SQLite", "SCPI", "USB Serial"],
  },
} as const;
