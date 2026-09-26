import { LEGAL } from '@/config/legal';
import { CONFIG } from '@/config/constants';
import type { Lang } from '@/i18n';

/**
 * Politica de confidențialitate și politica de cookie-uri, în română, rusă și engleză.
 * Descriu exact ce face codul (date colectate, stocare pe dispozitiv, servicii externe). La orice schimbare
 * a datelor sau a serviciilor folosite, textele se actualizează aici (în toate limbile) și `LEGAL.updated`.
 */
export interface LegalSection {
  h: string;
  p?: string[];
  list?: string[];
}
export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

const L = LEGAL;
const R = CONFIG.REPORT_EXPIRY_H;

// ---------------------------------------------------------------- Politica de confidențialitate

const PRIVACY: Record<Lang, LegalDoc> = {
  ro: {
    title: 'Politica de confidențialitate',
    updated: `Ultima actualizare: ${L.updated}`,
    intro:
      'Work In Progress este o hartă a deconectărilor de apă, energie electrică și gaz din Chișinău: anunțurile oficiale ale furnizorilor și problemele raportate de locuitori. Această politică explică ce date personale prelucrăm, de ce, cât timp și ce drepturi ai, conform Regulamentului (UE) 2016/679 (GDPR) și legislației Republicii Moldova privind protecția datelor cu caracter personal.',
    sections: [
      {
        h: '1. Cine este operatorul',
        p: [`${L.controller}, IDNO ${L.idno}, ${L.address}.`, `Pentru orice întrebare sau cerere privind datele tale: ${L.email}.`],
      },
      {
        h: '2. Ce date prelucrăm',
        list: [
          'Cont: numele, adresa de email și, dacă intri cu Google, poza de profil de la Google. Parola este gestionată de Firebase Authentication și nu o vedem niciodată.',
          'Date de cont interne: rolul (utilizator, utilizator de încredere etc.), scorul de credibilitate, numărul de raportări și confirmări, limba și preferința pentru notificări, datele de creare și actualizare.',
          'Adresele salvate: adresa de acasă și până la 5 alte adrese, cu numele dat de tine și coordonatele lor.',
          'Raportări: tipul problemei (apă, gaz, electricitate), locul (coordonate, strada, sectorul), gravitatea, descrierea opțională, ora și identificatorul autorului.',
          'Confirmări: răspunsul „da” / „nu” la o raportare, un identificator aleator al dispozitivului, identificatorul contului (dacă ești autentificat) și ora.',
          'Istoricul tău: ce ai raportat, confirmat sau infirmat, cu titlul evenimentului și ora.',
          'Locația: poziția GPS este folosită doar pe dispozitivul tău, ca să-ți arătăm ce e aproape și să te întrebăm despre raportările aflate la cel mult 50 m. Nu o trimitem serverelor noastre; se trimite doar locul unei raportări pe care o creezi. Dacă introduci manual o adresă, aceasta rămâne pe dispozitiv (doar cu acordul pentru preferințe).',
          'Stocarea pe dispozitiv: vezi Politica de cookie-uri.',
          'Date tehnice: adresa IP și datele cererilor (browser, ora) ajung la furnizorii de găzduire și de hărți când folosești aplicația.',
        ],
      },
      {
        h: '3. De ce le prelucrăm și pe ce temei',
        list: [
          'Contul, adresele salvate, raportările și confirmările — pentru a-ți oferi serviciul pe care îl ceri (art. 6 alin. 1 lit. b GDPR).',
          'Identificatorul dispozitivului, scorul de credibilitate și regula „un vot pe dispozitiv” — pentru a preveni abuzurile și a păstra harta corectă (interes legitim, art. 6 alin. 1 lit. f GDPR).',
          'Localizarea — doar după ce o permiți în browser; o poți retrage oricând din setările browserului.',
          'Preferințele salvate pe dispozitiv (limba, tema, raza, adresa introdusă manual) — doar cu acordul tău (art. 6 alin. 1 lit. a GDPR), pe care îl poți retrage oricând.',
          'Nu folosim datele pentru publicitate, nu le vindem și nu facem profilare de marketing.',
        ],
      },
      {
        h: '4. Ce este public',
        p: [
          'Raportările (tipul, locul, gravitatea, descrierea și numărul de confirmări) sunt vizibile tuturor utilizatorilor hărții. Numele și emailul tău nu sunt afișate lângă raportare. Nu include date personale în descriere.',
        ],
      },
      {
        h: '5. Cui transmitem datele',
        p: ['Folosim următorii furnizori, care prelucrează date în numele nostru sau ne livrează conținut:'],
        list: [
          'Google (Firebase Authentication, Cloud Firestore, autentificarea cu Google, Google Fonts) — contul, datele din aplicație, IP-ul. Google poate prelucra date în afara Republicii Moldova și a UE, inclusiv în SUA, pe baza clauzelor contractuale standard și a EU–US Data Privacy Framework.',
          'Vercel Inc. (găzduirea aplicației) — IP-ul și jurnalele tehnice ale cererilor; SUA, cu clauze contractuale standard.',
          'CARTO (imaginile hărții) — IP-ul și zona de hartă afișată.',
          'OpenStreetMap: Nominatim (căutarea adreselor, textul căutat) și Overpass (servere din Germania: coordonatele pinului unei raportări, pentru a găsi strada).',
          'Nu transmitem datele autorităților decât dacă legea ne obligă.',
        ],
      },
      {
        h: '6. Cât timp păstrăm datele',
        list: [
          'Contul, adresele salvate și istoricul — până când îți ștergi contul din Setări.',
          `Raportările — apar pe hartă până se confirmă, expiră (după ${R} ore fără confirmări) sau le ștergi; în baza de date rămân până la ștergerea lor de către tine. După ștergerea contului, raportările rămase nu mai pot fi legate de tine.`,
          'Confirmările — cât timp există raportarea.',
          'Stocarea pe dispozitiv — până o ștergi din browser sau îți retragi acordul (vezi Politica de cookie-uri).',
          'Jurnalele tehnice ale furnizorilor — conform politicilor acestora, de regulă câteva săptămâni.',
        ],
      },
      {
        h: '7. Drepturile tale',
        list: [
          'Acces — să afli ce date avem despre tine și să primești o copie.',
          'Rectificare — să corectezi datele greșite (numele și adresele le poți modifica direct din Setări).',
          'Ștergere — „Șterge contul” din Setări șterge profilul, adresele, istoricul și contul de autentificare. Raportările proprii le poți șterge una câte una.',
          'Restricționare și opoziție — mai ales față de prelucrările bazate pe interes legitim.',
          'Portabilitate — să primești datele contului într-un format structurat.',
          'Retragerea acordului — oricând, din Setări → Cookie-uri, fără a afecta prelucrările anterioare.',
          `Pentru orice cerere, scrie-ne la ${L.email}. Răspundem în cel mult 30 de zile.`,
        ],
      },
      {
        h: '8. Plângeri',
        p: [
          'Poți depune o plângere la Centrul Național pentru Protecția Datelor cu Caracter Personal al Republicii Moldova (datepersonale.md) sau, dacă locuiești în UE, la autoritatea de protecție a datelor din țara ta.',
        ],
      },
      {
        h: '9. Securitate',
        p: [
          'Conexiunile sunt criptate (HTTPS). Accesul la date este limitat prin regulile de securitate ale bazei de date: doar tu îți vezi profilul, adresele și istoricul; parolele sunt gestionate exclusiv de Firebase Authentication.',
        ],
      },
      { h: '10. Copii', p: ['Aplicația nu se adresează persoanelor sub 16 ani, iar crearea unui cont de către acestea necesită acordul părintelui.'] },
      {
        h: '11. Decizii automate',
        p: [
          'Statusul unei raportări („Neconfirmat”, „Confirmat”, „Contestat”, „Expirat”) se stabilește automat, după numărul de confirmări și timp. Aceasta nu produce efecte juridice asupra ta.',
        ],
      },
      { h: '12. Modificări', p: ['Când schimbăm această politică, actualizăm data de mai sus; la schimbări importante te anunțăm în aplicație.'] },
    ],
  },
  ru: {
    title: 'Политика конфиденциальности',
    updated: `Последнее обновление: ${L.updated}`,
    intro:
      'Work In Progress — карта отключений воды, электроэнергии и газа в Кишинёве: официальные объявления поставщиков и проблемы, о которых сообщают жители. Эта политика объясняет, какие персональные данные мы обрабатываем, зачем, как долго и какие у вас права, в соответствии с Регламентом (ЕС) 2016/679 (GDPR) и законодательством Республики Молдова о защите персональных данных.',
    sections: [
      {
        h: '1. Кто является оператором',
        p: [`${L.controller}, IDNO ${L.idno}, ${L.address}.`, `По любым вопросам и запросам о ваших данных: ${L.email}.`],
      },
      {
        h: '2. Какие данные мы обрабатываем',
        list: [
          'Аккаунт: имя, адрес эл. почты и, при входе через Google, фото профиля Google. Паролем управляет Firebase Authentication, мы его никогда не видим.',
          'Внутренние данные аккаунта: роль (пользователь, доверенный пользователь и т. д.), рейтинг достоверности, число сообщений и подтверждений, язык и настройка уведомлений, даты создания и обновления.',
          'Сохранённые адреса: домашний адрес и до 5 других адресов с вашими названиями и координатами.',
          'Сообщения: тип проблемы (вода, газ, электричество), место (координаты, улица, сектор), серьёзность, необязательное описание, время и идентификатор автора.',
          'Подтверждения: ответ «да» / «нет» на сообщение, случайный идентификатор устройства, идентификатор аккаунта (если вы вошли) и время.',
          'Ваша история: что вы сообщили, подтвердили или опровергли, с названием события и временем.',
          'Местоположение: GPS используется только на вашем устройстве, чтобы показать то, что рядом, и спросить о сообщениях в пределах 50 м. Мы не отправляем его на наши серверы; отправляется только место сообщения, которое вы создаёте. Адрес, введённый вручную, остаётся на устройстве (только с согласием на настройки).',
          'Хранение на устройстве: см. Политику cookie.',
          'Технические данные: IP-адрес и данные запросов (браузер, время) получают провайдеры хостинга и карт при использовании приложения.',
        ],
      },
      {
        h: '3. Зачем и на каком основании',
        list: [
          'Аккаунт, сохранённые адреса, сообщения и подтверждения — чтобы предоставить запрошенный вами сервис (ст. 6 ч. 1 п. b GDPR).',
          'Идентификатор устройства, рейтинг достоверности и правило «один голос с устройства» — чтобы предотвращать злоупотребления и сохранять карту точной (законный интерес, ст. 6 ч. 1 п. f GDPR).',
          'Геолокация — только после разрешения в браузере; его можно отозвать в настройках браузера в любой момент.',
          'Настройки, сохранённые на устройстве (язык, тема, радиус, введённый вручную адрес) — только с вашего согласия (ст. 6 ч. 1 п. a GDPR), которое можно отозвать в любой момент.',
          'Мы не используем данные для рекламы, не продаём их и не проводим маркетинговое профилирование.',
        ],
      },
      {
        h: '4. Что видно всем',
        p: [
          'Сообщения (тип, место, серьёзность, описание и число подтверждений) видны всем пользователям карты. Ваше имя и почта рядом с сообщением не показываются. Не указывайте персональные данные в описании.',
        ],
      },
      {
        h: '5. Кому мы передаём данные',
        p: ['Мы пользуемся следующими поставщиками, которые обрабатывают данные от нашего имени или предоставляют контент:'],
        list: [
          'Google (Firebase Authentication, Cloud Firestore, вход через Google, Google Fonts) — аккаунт, данные приложения, IP. Google может обрабатывать данные за пределами Молдовы и ЕС, в том числе в США, на основе стандартных договорных положений и EU–US Data Privacy Framework.',
          'Vercel Inc. (хостинг приложения) — IP и технические журналы запросов; США, со стандартными договорными положениями.',
          'CARTO (изображения карты) — IP и показываемая область карты.',
          'OpenStreetMap: Nominatim (поиск адресов, текст запроса) и Overpass (серверы в Германии: координаты метки сообщения, чтобы определить улицу).',
          'Мы не передаём данные органам власти, если этого не требует закон.',
        ],
      },
      {
        h: '6. Как долго мы храним данные',
        list: [
          'Аккаунт, сохранённые адреса и история — до удаления аккаунта в Настройках.',
          `Сообщения — показываются на карте, пока не подтверждены, не истекли (через ${R} ч без подтверждений) или не удалены вами; в базе остаются до их удаления вами. После удаления аккаунта оставшиеся сообщения больше нельзя связать с вами.`,
          'Подтверждения — пока существует сообщение.',
          'Хранение на устройстве — пока вы не очистите его в браузере или не отзовёте согласие (см. Политику cookie).',
          'Технические журналы поставщиков — согласно их политикам, обычно несколько недель.',
        ],
      },
      {
        h: '7. Ваши права',
        list: [
          'Доступ — узнать, какие данные о вас у нас есть, и получить их копию.',
          'Исправление — исправить неверные данные (имя и адреса можно изменить прямо в Настройках).',
          'Удаление — «Удалить аккаунт» в Настройках удаляет профиль, адреса, историю и сам аккаунт входа. Свои сообщения можно удалить по одному.',
          'Ограничение и возражение — особенно против обработки на основе законного интереса.',
          'Переносимость — получить данные аккаунта в структурированном формате.',
          'Отзыв согласия — в любой момент в Настройки → Cookie, без влияния на прежнюю обработку.',
          `По любому запросу пишите нам: ${L.email}. Мы отвечаем в течение 30 дней.`,
        ],
      },
      {
        h: '8. Жалобы',
        p: [
          'Вы можете подать жалобу в Национальный центр по защите персональных данных Республики Молдова (datepersonale.md) или, если вы живёте в ЕС, в орган по защите данных вашей страны.',
        ],
      },
      {
        h: '9. Безопасность',
        p: [
          'Соединения зашифрованы (HTTPS). Доступ к данным ограничен правилами безопасности базы данных: только вы видите свой профиль, адреса и историю; паролями управляет исключительно Firebase Authentication.',
        ],
      },
      { h: '10. Дети', p: ['Приложение не предназначено для лиц младше 16 лет; создание ими аккаунта требует согласия родителя.'] },
      {
        h: '11. Автоматические решения',
        p: [
          'Статус сообщения («Не подтверждено», «Подтверждено», «Оспорено», «Истекло») определяется автоматически по числу подтверждений и времени. Это не влечёт для вас юридических последствий.',
        ],
      },
      { h: '12. Изменения', p: ['При изменении политики мы обновляем дату выше; о важных изменениях сообщаем в приложении.'] },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: `Last updated: ${L.updated}`,
    intro:
      'Work In Progress is a map of water, power and gas outages in Chișinău: official notices from the utilities and problems reported by residents. This policy explains what personal data we process, why, for how long and what your rights are, under Regulation (EU) 2016/679 (GDPR) and the personal data protection laws of the Republic of Moldova.',
    sections: [
      {
        h: '1. Who the controller is',
        p: [`${L.controller}, IDNO ${L.idno}, ${L.address}.`, `For any question or request about your data: ${L.email}.`],
      },
      {
        h: '2. What data we process',
        list: [
          'Account: your name, email address and, if you sign in with Google, your Google profile photo. Your password is handled by Firebase Authentication and we never see it.',
          'Internal account data: your role (user, trusted user, etc.), credibility score, number of reports and confirmations, language and notification preference, creation and update dates.',
          'Saved addresses: your home address and up to 5 other addresses, with the names you give them and their coordinates.',
          'Reports: the type of problem (water, gas, electricity), the place (coordinates, street, district), severity, optional description, time and the author identifier.',
          'Confirmations: your “yes” / “no” answer to a report, a random device identifier, your account identifier (if signed in) and the time.',
          'Your history: what you reported, confirmed or denied, with the event title and time.',
          'Location: your GPS position is used only on your device, to show you what is nearby and to ask you about reports within 50 m. We do not send it to our servers; only the place of a report you create is sent. An address you enter manually stays on your device (only with consent for preferences).',
          'Storage on your device: see the Cookie Policy.',
          'Technical data: your IP address and request details (browser, time) reach the hosting and map providers when you use the app.',
        ],
      },
      {
        h: '3. Why we process it and on what legal basis',
        list: [
          'Account, saved addresses, reports and confirmations — to provide the service you ask for (Art. 6(1)(b) GDPR).',
          'The device identifier, the credibility score and the “one vote per device” rule — to prevent abuse and keep the map accurate (legitimate interest, Art. 6(1)(f) GDPR).',
          'Location — only after you allow it in your browser; you can withdraw it at any time in your browser settings.',
          'Preferences saved on your device (language, theme, radius, manually entered address) — only with your consent (Art. 6(1)(a) GDPR), which you can withdraw at any time.',
          'We do not use your data for advertising, we do not sell it and we do no marketing profiling.',
        ],
      },
      {
        h: '4. What is public',
        p: [
          'Reports (type, place, severity, description and number of confirmations) are visible to all users of the map. Your name and email are not shown next to a report. Do not include personal data in the description.',
        ],
      },
      {
        h: '5. Who we share data with',
        p: ['We use the following providers, which process data on our behalf or deliver content:'],
        list: [
          'Google (Firebase Authentication, Cloud Firestore, Google sign-in, Google Fonts) — your account, app data, IP address. Google may process data outside Moldova and the EU, including in the US, under standard contractual clauses and the EU–US Data Privacy Framework.',
          'Vercel Inc. (app hosting) — IP address and technical request logs; US, under standard contractual clauses.',
          'CARTO (map images) — IP address and the map area shown.',
          'OpenStreetMap: Nominatim (address search, the text you search) and Overpass (servers in Germany: the coordinates of a report pin, to find the street).',
          'We do not share data with authorities unless the law requires it.',
        ],
      },
      {
        h: '6. How long we keep data',
        list: [
          'Account, saved addresses and history — until you delete your account in Settings.',
          `Reports — shown on the map until they are confirmed, expire (after ${R} hours without confirmations) or you delete them; they stay in the database until you delete them. After you delete your account, remaining reports can no longer be linked to you.`,
          'Confirmations — as long as the report exists.',
          'Storage on your device — until you clear it in your browser or withdraw consent (see the Cookie Policy).',
          'Providers’ technical logs — according to their policies, usually a few weeks.',
        ],
      },
      {
        h: '7. Your rights',
        list: [
          'Access — to know what data we hold about you and receive a copy.',
          'Rectification — to correct inaccurate data (you can change your name and addresses directly in Settings).',
          'Erasure — “Delete account” in Settings deletes your profile, addresses, history and your sign-in account. You can delete your own reports one by one.',
          'Restriction and objection — in particular to processing based on legitimate interest.',
          'Portability — to receive your account data in a structured format.',
          'Withdrawing consent — at any time in Settings → Cookies, without affecting earlier processing.',
          `For any request, write to us at ${L.email}. We reply within 30 days.`,
        ],
      },
      {
        h: '8. Complaints',
        p: [
          'You can complain to the National Center for Personal Data Protection of the Republic of Moldova (datepersonale.md) or, if you live in the EU, to the data protection authority of your country.',
        ],
      },
      {
        h: '9. Security',
        p: [
          'Connections are encrypted (HTTPS). Access to data is limited by the database security rules: only you can see your profile, addresses and history; passwords are handled exclusively by Firebase Authentication.',
        ],
      },
      { h: '10. Children', p: ['The app is not intended for people under 16; creating an account at that age requires a parent’s consent.'] },
      {
        h: '11. Automated decisions',
        p: [
          'The status of a report (“Unconfirmed”, “Confirmed”, “Disputed”, “Expired”) is set automatically from the number of confirmations and time. It has no legal effects on you.',
        ],
      },
      { h: '12. Changes', p: ['When we change this policy we update the date above; for important changes we notify you in the app.'] },
    ],
  },
};

// ---------------------------------------------------------------- Politica de cookie-uri

const COOKIES: Record<Lang, LegalDoc> = {
  ro: {
    title: 'Politica de cookie-uri',
    updated: `Ultima actualizare: ${L.updated}`,
    intro:
      'Aplicația nu folosește cookie-uri proprii de analiză sau publicitate. Pentru a funcționa, păstrează câteva informații în memoria browserului (localStorage și IndexedDB), tehnologii tratate la fel ca cookie-urile. Mai jos găsești ce anume, de ce și cum îți schimbi alegerea.',
    sections: [
      {
        h: '1. Strict necesare (mereu active)',
        p: ['Fără ele aplicația nu funcționează corect; nu cer acordul tău.'],
        list: [
          'Alegerea ta din bannerul de cookie-uri (wip.consent).',
          'Un identificator aleator al dispozitivului (wip.deviceId), ca fiecare dispozitiv să poată vota o singură dată o raportare.',
          'Voturile date de pe acest dispozitiv (wip.votes).',
          'Raportările tale până ajung pe server și cele pe care le-ai șters (wip.userReports, wip.deleted), versiunea datelor locale (wip.dataVersion).',
          'Sesiunea de autentificare Firebase (IndexedDB „firebaseLocalStorageDb”), ca să rămâi conectat.',
        ],
      },
      {
        h: '2. Preferințe (doar cu acordul tău)',
        list: [
          'Limba (wip.lang), tema (wip.theme) și raza afișată (wip.radius).',
          'Adresa introdusă manual când GPS-ul nu e disponibil (wip.manualPlace).',
          'Faptul că ai văzut ghidul de la prima vizită (wip.onboarded) și întrebările „Ai și tu problema asta?” pe care le-ai închis (wip.promptDismissed).',
          'Fără acord, aceste alegeri funcționează doar până închizi aplicația.',
        ],
      },
      {
        h: '3. Servicii terțe',
        list: [
          'Autentificarea cu Google deschide o fereastră Google, care folosește cookie-urile Google conform politicii Google.',
          'Google Fonts (fonturile), CARTO (hărțile) și OpenStreetMap (căutarea adreselor) primesc adresa ta IP când browserul le descarcă conținutul; aplicația nu setează cookie-uri pentru ele.',
          'Nu folosim instrumente de analiză, pixeli de urmărire sau publicitate.',
        ],
      },
      {
        h: '4. Cât timp se păstrează',
        p: ['Informațiile rămân în browser până le ștergi (din setările browserului), până îți retragi acordul pentru preferințe sau până ieși din cont (sesiunea de autentificare).'],
      },
      {
        h: '5. Cum îți schimbi alegerea',
        p: [
          'Din Setări → „Cookie-uri și confidențialitate” poți accepta sau refuza oricând preferințele; la refuz, le ștergem imediat de pe dispozitiv. Poți șterge oricând toate datele din setările browserului.',
          `Întrebări: ${L.email}.`,
        ],
      },
    ],
  },
  ru: {
    title: 'Политика cookie',
    updated: `Последнее обновление: ${L.updated}`,
    intro:
      'Приложение не использует собственные cookie для аналитики или рекламы. Для работы оно хранит немного информации в памяти браузера (localStorage и IndexedDB) — эти технологии рассматриваются так же, как cookie. Ниже — что именно, зачем и как изменить ваш выбор.',
    sections: [
      {
        h: '1. Строго необходимые (всегда активны)',
        p: ['Без них приложение не работает правильно; ваше согласие не требуется.'],
        list: [
          'Ваш выбор в баннере cookie (wip.consent).',
          'Случайный идентификатор устройства (wip.deviceId), чтобы с каждого устройства можно было проголосовать за сообщение только один раз.',
          'Голоса с этого устройства (wip.votes).',
          'Ваши сообщения до их появления на сервере и удалённые вами (wip.userReports, wip.deleted), версия локальных данных (wip.dataVersion).',
          'Сессия входа Firebase (IndexedDB «firebaseLocalStorageDb»), чтобы вы оставались в аккаунте.',
        ],
      },
      {
        h: '2. Настройки (только с вашего согласия)',
        list: [
          'Язык (wip.lang), тема (wip.theme) и радиус отображения (wip.radius).',
          'Адрес, введённый вручную, когда GPS недоступен (wip.manualPlace).',
          'То, что вы уже видели вводное руководство (wip.onboarded), и закрытые вами вопросы «У вас тоже эта проблема?» (wip.promptDismissed).',
          'Без согласия эти настройки действуют только до закрытия приложения.',
        ],
      },
      {
        h: '3. Сторонние сервисы',
        list: [
          'Вход через Google открывает окно Google, которое использует cookie Google согласно политике Google.',
          'Google Fonts (шрифты), CARTO (карты) и OpenStreetMap (поиск адресов) получают ваш IP-адрес, когда браузер загружает их содержимое; приложение не устанавливает для них cookie.',
          'Мы не используем инструменты аналитики, пиксели отслеживания или рекламу.',
        ],
      },
      {
        h: '4. Как долго хранится',
        p: ['Информация остаётся в браузере, пока вы её не удалите (в настройках браузера), не отзовёте согласие на настройки или не выйдете из аккаунта (сессия входа).'],
      },
      {
        h: '5. Как изменить выбор',
        p: [
          'В Настройки → «Cookie и конфиденциальность» вы в любой момент можете принять или отклонить настройки; при отказе мы сразу удаляем их с устройства. Все данные можно удалить в настройках браузера.',
          `Вопросы: ${L.email}.`,
        ],
      },
    ],
  },
  en: {
    title: 'Cookie Policy',
    updated: `Last updated: ${L.updated}`,
    intro:
      'The app does not use its own analytics or advertising cookies. To work, it keeps a little information in your browser’s storage (localStorage and IndexedDB), technologies treated the same way as cookies. Below is what exactly, why, and how to change your choice.',
    sections: [
      {
        h: '1. Strictly necessary (always on)',
        p: ['The app does not work correctly without them; they do not require your consent.'],
        list: [
          'Your choice in the cookie banner (wip.consent).',
          'A random device identifier (wip.deviceId), so each device can vote on a report only once.',
          'The votes given from this device (wip.votes).',
          'Your reports until they reach the server and those you deleted (wip.userReports, wip.deleted), the local data version (wip.dataVersion).',
          'The Firebase sign-in session (IndexedDB “firebaseLocalStorageDb”), so you stay signed in.',
        ],
      },
      {
        h: '2. Preferences (only with your consent)',
        list: [
          'Language (wip.lang), theme (wip.theme) and the radius shown (wip.radius).',
          'The address you entered when GPS is not available (wip.manualPlace).',
          'That you have seen the first-visit guide (wip.onboarded) and the “Do you have this problem too?” questions you closed (wip.promptDismissed).',
          'Without consent, these choices only last until you close the app.',
        ],
      },
      {
        h: '3. Third-party services',
        list: [
          'Google sign-in opens a Google window, which uses Google’s cookies under Google’s policy.',
          'Google Fonts (fonts), CARTO (maps) and OpenStreetMap (address search) receive your IP address when your browser downloads their content; the app does not set cookies for them.',
          'We use no analytics tools, tracking pixels or advertising.',
        ],
      },
      {
        h: '4. How long it is kept',
        p: ['The information stays in your browser until you delete it (in your browser settings), withdraw consent for preferences, or sign out (the sign-in session).'],
      },
      {
        h: '5. How to change your choice',
        p: [
          'In Settings → “Cookies and privacy” you can accept or refuse preferences at any time; if you refuse, we delete them from your device immediately. You can delete all data at any time in your browser settings.',
          `Questions: ${L.email}.`,
        ],
      },
    ],
  },
};

export const privacyPolicy = (lang: Lang) => PRIVACY[lang];
export const cookiePolicy = (lang: Lang) => COOKIES[lang];
