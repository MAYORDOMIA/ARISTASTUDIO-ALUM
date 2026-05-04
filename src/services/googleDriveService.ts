// Google Drive Service
export const getGoogleDriveAuthUrl = async () => {
  // En un entorno de producción, esto llamaría a tu backend.
  // Por ahora, simulamos la construcción de la URL de autorización.
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const redirectUri = `${window.location.origin}/auth/callback`;
  const scope = "https://www.googleapis.com/auth/drive.file";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scope,
    access_type: "offline",
    prompt: "consent",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

export const saveBudgetToDrive = async (budget: any, accessToken: string) => {
  console.log("Saving budget to Drive...", budget);
  // Aquí iría la lógica para llamar a la API de Google Drive
};

export const loadBudgetsFromDrive = async (accessToken: string) => {
  console.log("Loading budgets from Drive...");
  return [];
};
