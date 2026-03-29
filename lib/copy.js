const copy = {
  en: {
    common: {
      loadingUserName: 'Developer',
      serverError: 'A server error occurred.',
      routeLoadError: 'Unable to load route data.',
      saveError: 'Something went wrong while saving your selection.',
      saveSuccess: 'Your stop has been saved.',
      openInGoogleMaps: 'Open in Google Maps',
      rideAt: 'Board at',
      stopNumber: 'Stop',
      line: 'LINE',
    },
    home: {
      noRegistration: 'No registered stop was found. Please choose your stop first.',
      findStop: 'Find a Stop',
      later: 'Later',
      qrComingSoon: 'QR scanning will be available soon.',
      scanQr: 'Scan QR Code',
      changeStop: 'Change Stop',
    },
    search: {
      title: 'Register My Stop',
      registerButton: 'Register This Stop',
    },
    stopDetail: {
      title: 'Stop Details',
      chooseRoute: 'Choose the route for this stop',
      noResults: 'No matching stop details were found.',
      noSelection: 'Select the correct route and time for this stop.',
      registerButton: 'Register Stop',
      routeMap: 'Route map',
      stopMap: 'Stop location',
      stopPreview: 'Stop location preview',
      notes: 'Notes',
      route: 'Route',
      stopOrder: 'Stop',
      boardAt: 'Board at',
    },
  },
  ko: {},
}

export function getCopy(locale = 'en') {
  return copy[locale] ?? copy.en
}
