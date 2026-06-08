# PatriotsMessenger

PatriotsMessenger is a Next.js + Capacitor app that signs users in through [AuthFlow](https://www.authflow.net), stores public user/key metadata in The Patriots Voice Firebase functions, and relays encrypted message envelopes through the socket-capable `chatend` server, across which plaintexts are never transmitted.

## Local development

```sh
npm install
npm run dev
```

Configure:

- `NEXT_PUBLIC_AUTHFLOW_API_URL`
- `NEXT_PUBLIC_AUTHFLOW_API_KEY`
- `NEXT_PUBLIC_THEPATRIOTSVOICE_API_URL`
- `NEXT_PUBLIC_PATRIOTS_MESSENGER_SOCKET_URL`

Message plaintext is encrypted in the browser with WebCrypto before it is sent to functions or sockets.

## Android

The Capacitor Android project lives in `android/`.

```sh
npm run build
npm exec cap sync android
cd android
./gradlew assembleDebug
```

To open the project in Android Studio:

```sh
npm run cap:open:android
```

Gradle needs a local Android SDK. Set `ANDROID_HOME` or add an `android/local.properties` file with `sdk.dir=/path/to/android/sdk`.
