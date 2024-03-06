const yiviServer = document.getElementById("yiviServer").getAttribute('data');
// Get the session response
const yiviFullSessionEncoded = document.getElementById("yiviFullSession").getAttribute('data');

if (yiviFullSessionEncoded) {

    const yiviFullSession = JSON.parse(atob(yiviFullSessionEncoded));

    const yiviClient = yivi.newWeb({
        debugging: false,
        element: '#yivi-web-form',
        session: {
            url: yiviServer,
            start: false, // No need to start session from the browser (done server-sied)
            mapping: {
                sessionPtr: r => yiviFullSession.sessionPtr,
                sessionToken: r => yiviFullSession.token,
                frontendRequest: r => yiviFullSession.frontendRequest
            },
            result: false, // No need to fetch session result (status success / failed is sufficient)
        },
        state: {
            serverSentEvents: false,
            frontendOptions: {
                endpoint: 'options',
                requestContext: 'https://irma.app/ld/request/frontendoptions/v1'
            },
            pairing: {
                onlyEnableIf: m => yiviFullSession.frontendRequest.pairingHint,
                completedEndpoint: 'pairingcompleted',
                minCheckingDelay: 500, // Minimum delay before accepting or rejecting a pairing code, for better user experience.
                pairingMethod: 'pin'
            }
        }
    });

    yiviClient.start()
        .then(() => console.log('Issuing completed!'))
        .catch((err) => {
            document.getElementById('retry-button').classList.remove('hidden');
            document.getElementById('logout-button').classList.remove('hidden');
            console.error("Could not complete issuing session", err);
        });
}