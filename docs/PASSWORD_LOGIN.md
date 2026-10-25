# Login med valgfri adgangskode

TEB → Foreninger → vælg forening → Personer med adgang → Sæt adgangskode.
Adgangskoden knyttes til personens eksisterende loginmail, også når den bruges til flere foreninger.
En anden administrator skal vælge sin egen kode. Kun TEB-administratorer kan tildele andres koder.

På login vælges Log ind med adgangskode. Mailkode fungerer fortsat, også som hjælp ved glemt kode.
Efter login kan personen sætte eller ændre koden under Min adgangskode. Minimum 12, maksimum 128 tegn.
Administrationen viser aldrig eksisterende adgangskoder. Der sendes ingen mail ved tildeling eller ændring.
TEB kan dele den valgte kode med modtageren separat.

Adgangskodelogin accepterer kun den invitation, TEB eksplicit har knyttet koden til,
og kun mens invitationen er gyldig. Tilbagekaldte adgange genaktiveres aldrig.
En udløbet invitation skal fornyes før tildeling. Eksisterende aktive adgange kræver ikke en ny invitation.

## Teknik og udgivelse

Migration 0008_password_login.sql opretter kun password_credentials. Produktions- og
staging skal have migrationen anvendt før Worker-deploy. GitHubs eksisterende deploy-token har ikke D1-adgang; brug Cloudflare-forbindelsen til migrationen, og registrér den i d1_migrations. Almindelige OTP-konti er uændrede.

Adgangskoder gemmes som PBKDF2-SHA-256 med 100.000 iterationer, tilfældigt salt og server-side
HMAC-pepper via den eksisterende MAIL_ENCRYPTION_KEY. Bevar nøglen i backup/rotation;
ændres den, skal adgangskoder vælges igen gennem mailkode-login.
Der bruges konstanttids-sammenligning, grænser per IP/mail/globalt og eksisterende HttpOnly/Secure-cookies.
Nulstilling afslutter øvrige sessioner. Versionskontrol i samme D1-batch forhindrer en
samtidig nulstilling i at udstede en session fra den gamle kode.
