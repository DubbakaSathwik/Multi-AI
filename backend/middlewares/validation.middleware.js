export function validatePrompt(request, response, next) {
  const { prompt } = request.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return response.status(400).json({
      success: false,
      message: 'Prompt is required'
    });
  }

  if (prompt.length > 8000) {
    return response.status(413).json({
      success: false,
      message: 'Prompt is too long. Please keep it under 8000 characters.'
    });
  }

  return next();
}

export function validateClientId(request, response, next) {
  const clientId = request.body?.clientId || request.query?.clientId;

  if (
    !clientId ||
    typeof clientId !== 'string' ||
    clientId.length > 120 ||
    !/^[a-zA-Z0-9._:-]+$/.test(clientId)
  ) {
    return response.status(400).json({
      success: false,
      message: 'A valid clientId is required.'
    });
  }

  return next();
}

export function validateAuthPayload(request, response, next) {
  const { username, email, password } = request.body || {};
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const rawPassword = typeof password === 'string' ? password : '';

  if (!normalizedUsername || normalizedUsername.length < 3 || normalizedUsername.length > 50) {
    return response.status(400).json({
      success: false,
      message: 'Username must be 3 to 50 characters.'
    });
  }

  if (request.path.includes('register')) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return response.status(400).json({
        success: false,
        message: 'A valid email is required.'
      });
    }

    if (rawPassword.length < 8 || rawPassword.length > 128) {
      return response.status(400).json({
        success: false,
        message: 'Password must be 8 to 128 characters.'
      });
    }
  }

  if (!rawPassword) {
    return response.status(400).json({
      success: false,
      message: 'Password is required.'
    });
  }

  request.body.username = normalizedUsername;
  if (normalizedEmail) request.body.email = normalizedEmail;
  return next();
}
