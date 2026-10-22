// The SDK returns application keys in both camelCase and snake_case form.
type ApplicationKeys = {
  publicKey?: string;
  privateKey?: string;
  public_key?: string;
  private_key?: string;
};

export type CreatedApplication = {
  id?: string;
  name: string;
  keys?: ApplicationKeys;
};

export const PRIVATE_KEY_ADVISORY = `IMPORTANT: Store this private key securely now. Vonage will not return it again.
- Save it to a file such as private.key, or base64-encode it into VONAGE_PRIVATE_KEY64.
- Never commit the private key to version control.`;

/**
 * Build the create-application tool response. The private key is shown once,
 * followed by a storage advisory, and is omitted from the full details dump.
 */
export function formatCreateApplicationResponse(
  application: CreatedApplication
): string {
  const privateKey =
    application.keys?.privateKey ?? application.keys?.private_key;

  const lines = [
    'Application created successfully:',
    `Name: ${application.name}`,
    `Application ID: ${application.id}`,
  ];

  if (privateKey) {
    lines.push(`Private Key: ${privateKey}`, '', PRIVATE_KEY_ADVISORY);
  }

  lines.push(
    '',
    `Full details: ${JSON.stringify(omitPrivateKey(application), null, 2)}`
  );

  return lines.join('\n');
}

function omitPrivateKey(application: CreatedApplication): CreatedApplication {
  if (!application.keys) {
    return application;
  }
  const {
    privateKey: _privateKey,
    private_key: _private_key,
    ...publicKeys
  } = application.keys;
  return { ...application, keys: publicKeys };
}
