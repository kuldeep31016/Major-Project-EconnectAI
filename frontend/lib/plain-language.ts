/**
 * One sentence per module, in everyday words, shown under each page title so a first-time visitor
 * (officer, funder, student) knows what the page is for before reading any numbers.
 */
export const PLAIN_PURPOSE: Record<string, string> = {
  dashboard: "A one-screen summary of the selected coast: how much mangrove was mapped, how well it is connected, and what needs attention.",
  analysis: "Which forest patches matter most, and why. Small patches that hold groups together can matter more than big ones.",
  graph: "The coast drawn as a network: dots are forest patches, lines are routes that wildlife and seeds can travel.",
  scenario: "Try a change, such as losing a patch or restoring a site, and see how the network responds. These are simulations, not forecasts.",
  simulation: "Try a change, such as losing a patch or restoring a site, and see how the network responds. These are simulations, not forecasts.",
  restoration: "Where planting would reconnect the most forest. Large uncertain areas are sent for a field check before any plan is made.",
  alerts: "Warnings raised by fixed rules on the latest results, such as a critical patch or a site to check. Each one shows the numbers behind it.",
  field: "Tasks for field staff: visit a place, record GPS and photos, and confirm or reject what the model found.",
  projects: "A conservation plan in one place: its goals, the patches it protects, restoration sites, field tasks and reports.",
  reports: "Printable reports that explain the results, how they were produced and their limits. Development results print as drafts.",
  experiments: "How the mapping models were trained and how closely they agree with the Global Mangrove Watch reference map.",
  history: "Every analysis run that has been stored, so results can be compared and reproduced.",
  upload: "Run the full analysis on a new satellite scene: find the mangroves, build the network and rank the patches.",
  audit: "A permanent record of who did what and when, so every decision can be traced.",
  system: "Technical health of the service: database, background jobs and response times.",
  settings: "Your account and display preferences.",
};

export const plainPurpose = (pathname: string) => PLAIN_PURPOSE[pathname.split("/").filter(Boolean)[0] ?? ""];
