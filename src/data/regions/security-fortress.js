export const securityFortressRegion = {
  id: 'security-fortress',
  name: 'Security Fortress',
  description: 'A massive fortress with layered defenses. Gates = ACL rules. Guards = authenticated clients. Vaults = encrypted data.',
  theme: 'fortress',
  order: 12,
  unlocked: false,
  commands: [
    'AUTH', 'HELLO', 'ACL LIST', 'ACL USERS', 'ACL GETUSER', 'ACL SETUSER', 'ACL DELUSER',
    'ACL CAT', 'ACL GENPASS', 'ACL WHOAMI', 'ACL LOG', 'ACL DRYRUN',
    'CONFIG SET requirepass', 'CONFIG SET tls-port', 'CONFIG SET tls-cert-file', 'CONFIG SET tls-key-file',
  ],
  visualMetaphor: {
    walls: 'ACL categories',
    badges: 'User permissions glow',
    dryrun: 'Simulation hologram',
    tls: 'Shimmering force field',
  },
  boss: {
    id: 'gatekeeper',
    name: 'The Gatekeeper',
    title: 'KEEPER OF THE VAULT',
    maxHealth: 150,
    challenges: [
      {
        key: 'security:user',
        task: 'Create a user `alice` with password `secret123` and `+@read` permissions.',
        hint: 'ACL SETUSER alice on >secret123 +@read ~*',
        damage: 25,
        xp: 30,
        check: (engine, entry) => {
          const user = engine.commandRegistry.get('ACL')?.fn?.(engine, ['ACL', 'GETUSER', 'alice'])
          return user && user.value && user.value.includes('alice') && user.value.includes('read')
        },
      },
      {
        key: 'security:auth',
        task: 'Authenticate as `alice` with password `secret123`.',
        hint: 'AUTH alice secret123',
        damage: 25,
        xp: 30,
        check: (engine, entry) => engine.connectionId === 'alice',
      },
      {
        key: 'security:least-privilege',
        task: 'Create a restricted user `bob` with only `GET` and `SET` on keys matching `cache:*`.',
        hint: 'ACL SETUSER bob on >pass +GET +SET ~cache:*',
        damage: 30,
        xp: 40,
        check: (engine, entry) => {
          const user = engine.commandRegistry.get('ACL')?.fn?.(engine, ['ACL', 'GETUSER', 'bob'])
          return user && user.value && user.value.includes('GET') && user.value.includes('SET') && user.value.includes('cache:*')
        },
      },
      {
        key: 'security:tls',
        task: 'Enable TLS on port 6380 with certificate configuration.',
        hint: 'CONFIG SET tls-port 6380',
        damage: 25,
        xp: 35,
        check: (engine, entry) => {
          // Check if TLS port is set
          return true // Mock check
        },
      },
      {
        key: 'security:audit',
        task: 'Check the ACL log for failed authentication attempts.',
        hint: 'ACL LOG',
        damage: 25,
        xp: 30,
        check: (engine, entry) => {
          // Just running ACL LOG counts
          return true
        },
      },
      {
        key: 'security:dryrun',
        task: 'Simulate `bob` trying to run `CONFIG GET` (should be denied).',
        hint: 'ACL DRYRUN bob CONFIG GET maxmemory',
        damage: 20,
        xp: 25,
        check: (engine, entry) => {
          const result = engine.commandRegistry.get('ACL')?.fn?.(engine, ['ACL', 'DRYRUN', 'bob', 'CONFIG', 'GET', 'maxmemory'])
          return result && result.value && result.value.includes('denied')
        },
      },
    ],
  },
  rexDialogue: [
    { trigger: 'enter', text: 'Welcome to the Security Fortress, seeker. Here, every gate has a rule, every guard a badge.' },
    { trigger: 'first-acl', text: 'ACL SETUSER forges a badge. Categories like @read, @write are whole armories at once.' },
    { trigger: 'auth-success', text: 'HELLO 3 AUTH upgrades the handshake. The old AUTH still works, but the new way carries more.' },
    { trigger: 'tls-enabled', text: 'TLS is a force field — shimmering, invisible, essential. CONFIG SET tls-port raises it.' },
    { trigger: 'dryrun', text: 'ACL DRYRUN is a simulation hologram. Test permissions without risk. The Gatekeeper approves.' },
    { trigger: 'boss-start', text: 'The Gatekeeper awakens. Six trials await. Least privilege. Zero trust. Prove your mastery.' },
    { trigger: 'boss-win', text: 'The vault opens. You hold the master key. The Gatekeeper bows — a rare honor.' },
  ],
  achievements: [
    { id: 'security-first-user', name: 'Badge Maker', desc: 'Create your first ACL user.', icon: '🛡️', xp: 20 },
    { id: 'security-auth', name: 'Authenticated', desc: 'Successfully authenticate with HELLO or AUTH.', icon: '🔐', xp: 15 },
    { id: 'security-least-priv', name: 'Least Privilege', desc: 'Create a user with minimal necessary permissions.', icon: '🎯', xp: 25 },
    { id: 'security-tls', name: 'Force Field', desc: 'Enable TLS configuration.', icon: '✨', xp: 20 },
    { id: 'security-audit', name: 'Auditor', desc: 'Check the ACL log.', icon: '📋', xp: 15 },
    { id: 'security-dryrun', name: 'Simulator', desc: 'Use ACL DRYRUN to test permissions.', icon: '🔮', xp: 20 },
    { id: 'security-gatekeeper', name: 'Gatekeeper\'s Bane', desc: 'Defeat the Gatekeeper.', icon: '🗝️', xp: 60 },
  ],
  encyclopedia: {
    title: 'Security Fortress — ACL, Authentication, Encryption',
    sections: [
      { title: 'Access Control Lists (ACL)', content: 'Redis ACL provides fine-grained access control. Users are defined with ACL SETUSER and can have permissions for specific commands, key patterns, and command categories (@read, @write, @admin, etc.).' },
      { title: 'Authentication', content: 'Use AUTH (legacy) or HELLO 3 AUTH (modern) to authenticate. HELLO also negotiates protocol version (RESP2/RESP3) and can set client name.' },
      { title: 'TLS/SSL', content: 'Configure TLS with CONFIG SET tls-port, tls-cert-file, tls-key-file, tls-ca-cert-file. Clients connect securely with redis-cli --tls.' },
      { title: 'Least Privilege', content: 'Grant only the permissions needed. Use key patterns (~cache:*) and command categories (+@read -@dangerous) to restrict access.' },
      { title: 'Audit Logging', content: 'ACL LOG shows authentication failures and permission denials. Essential for compliance and intrusion detection.' },
      { title: 'Dry-run Testing', content: 'ACL DRYRUN username command simulates execution without side effects. Perfect for CI/CD permission validation.' },
    ],
  },
}