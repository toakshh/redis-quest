export const CH1_DEBRIEFS = {
  'inc_ch1_set': {
    whatHappened: 'A machine needed a specific configuration value right away, but it was empty.',
    whatYouDid: 'You injected the correct value directly into the slot so the machine could keep working.',
    realWorldName: 'Storing a value',
    actualCommand: 'SET config:speed 100',
    whenToUse: 'When you need to remember a piece of information, like a user profile or a specific setting, so any part of your system can find it instantly.',
    ifWrong: 'The system might forget who the user is or use the wrong settings, causing parts of the service to fail or behave randomly.'
  },
  'inc_ch1_get': {
    whatHappened: 'Security requested to verify if an ID badge was valid, but they could not see inside the record.',
    whatYouDid: 'You scanned the ID badge record and handed them the contained information.',
    realWorldName: 'Retrieving a value',
    actualCommand: 'GET user:1042',
    whenToUse: 'When your application needs to look up a specific piece of information that was saved earlier, like checking a balance or a name.',
    ifWrong: 'If you grab the wrong record or it goes missing, the user might be denied access, or you might display someone else\'s information by mistake.'
  }
}
