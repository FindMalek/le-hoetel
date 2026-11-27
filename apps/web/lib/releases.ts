/**
 * What `/roadmap` shows. Public copy for hoteliers: no commit subjects, security details, internal or pricing topics,
 * hotel names or dates. `.github/scripts/release-notes.test.mjs` imports this file with plain node (keep it free of
 * runtime imports) and fails when the version in `package.json` has no notes. How to write them: the releases docs page.
 */
import type { Locale } from "@ritorno/i18n"

export type Localized = Record<Locale, string>

export const CHANGE_GROUPS = ["added", "improved", "fixed", "removed"] as const
export type ChangeGroup = (typeof CHANGE_GROUPS)[number]

export type Release = { version: string; summary: Localized } & Partial<Record<ChangeGroup, Localized[]>>

export interface Plan {
  title: Localized
  items: Localized[]
}

/** Open work only, without dates. Move an item into a release once it ships. */
export const NEXT: Plan[] = [
  {
    title: { en: "A guest inbox", fr: "Une messagerie clients", ar: "صندوق رسائل للنزلاء" },
    items: [
      {
        en: "Read and answer your guests' WhatsApp messages from the dashboard",
        fr: "Lire les messages WhatsApp de vos clients et y répondre depuis le tableau de bord",
        ar: "قراءة رسائل نزلائكم على واتساب والرد عليها من لوحة التحكم",
      },
      {
        en: "Photos and documents, live updates and alerts on your phone",
        fr: "Photos et documents, mise à jour en direct et alertes sur votre téléphone",
        ar: "الصور والمستندات، والتحديث الفوري والتنبيهات على هاتفكم",
      },
      {
        en: "Guest email replies in the same place",
        fr: "Les réponses e-mail des clients au même endroit",
        ar: "ردود النزلاء بالبريد الإلكتروني في المكان نفسه",
      },
    ],
  },
  {
    title: { en: "WhatsApp", fr: "WhatsApp", ar: "واتساب" },
    items: [
      {
        en: "Approval of our WhatsApp message templates",
        fr: "La validation de nos modèles de messages WhatsApp",
        ar: "اعتماد قوالب رسائلنا على واتساب",
      },
      {
        en: "A clearer way for guests to scan and write to you on WhatsApp",
        fr: "Une façon plus claire pour vos clients de scanner et de vous écrire sur WhatsApp",
        ar: "طريقة أوضح ليمسح النزيل الرمز ويراسلكم على واتساب",
      },
    ],
  },
  {
    title: { en: "At the front desk", fr: "À la réception", ar: "في الاستقبال" },
    items: [
      {
        en: "A today view: birthdays, expected departures, returning guests and open perks",
        fr: "Une vue du jour : anniversaires, départs prévus, clients de retour et avantages en cours",
        ar: "عرض لليوم: أعياد الميلاد، والمغادرون المتوقعون، والنزلاء العائدون، والمزايا المتاحة",
      },
      {
        en: "One timeline per guest with messages, offers and feedback",
        fr: "Un historique par client avec messages, offres et avis",
        ar: "سجل زمني لكل نزيل يجمع الرسائل والعروض والآراء",
      },
      {
        en: "An owner and a history for each unhappy guest case",
        fr: "Un responsable et un historique pour chaque client mécontent",
        ar: "مسؤول وسجل متابعة لكل حالة نزيل غير راضٍ",
      },
      {
        en: "A guest list you can sort, export and message by selection",
        fr: "Une liste clients à trier, exporter et contacter par sélection",
        ar: "قائمة نزلاء يمكن ترتيبها وتصديرها ومراسلة المحدّدين منها",
      },
    ],
  },
  {
    title: { en: "Campaigns and results", fr: "Campagnes et résultats", ar: "الحملات والنتائج" },
    items: [
      {
        en: "Checks before sending, such as guests whose language is missing",
        fr: "Des contrôles avant l'envoi, par exemple les clients dont la langue manque",
        ar: "فحص قبل الإرسال، مثل النزلاء الذين لم تُكتب الرسالة بلغتهم",
      },
      {
        en: "Ready-made campaigns and one page for all automatic messages",
        fr: "Des campagnes prêtes à l'emploi et une seule page pour tous les messages automatiques",
        ar: "حملات جاهزة وصفحة واحدة لكل الرسائل التلقائية",
      },
      {
        en: "Offers redeemed per campaign, returning-guest numbers and scans per room or table",
        fr: "Offres utilisées par campagne, chiffres de fidélité et scans par chambre ou table",
        ar: "العروض المستخدمة لكل حملة، وأرقام عودة النزلاء، وعدد المسحات لكل غرفة أو طاولة",
      },
    ],
  },
]

/** Newest first. A version above the one in `package.json` shows as upcoming. */
export const RELEASES: Release[] = [
  {
    version: "0.6.0",
    summary: {
      en: "Reaching a guest takes one tap, offers speak each guest's language, and campaigns are easier to reuse.",
      fr: "Joindre un client se fait en un geste, les offres parlent sa langue et les campagnes se réutilisent plus facilement.",
      ar: "التواصل مع النزيل بلمسة واحدة، والعروض بلغة كل نزيل، وإعادة استخدام الحملات أسهل.",
    },
    added: [
      {
        en: "Call, WhatsApp and email buttons on guest profiles, unhappy guest cases and home alerts. WhatsApp and email appear only when the guest agreed",
        fr: "Boutons appeler, WhatsApp et e-mail sur les fiches clients, les cas de clients mécontents et les alertes d'accueil. WhatsApp et e-mail n'apparaissent qu'avec l'accord du client",
        ar: "أزرار للاتصال وواتساب والبريد في ملف النزيل وحالات عدم الرضا وتنبيهات الصفحة الرئيسية. لا يظهر واتساب والبريد إلا بموافقة النزيل",
      },
      {
        en: "Offer title and text in English, French and Arabic, and QR cards printed in all three",
        fr: "Titre et texte des offres en français, anglais et arabe, et cartes QR imprimées dans les trois langues",
        ar: "عنوان العرض ونصه بالعربية والفرنسية والإنجليزية، وبطاقات QR مطبوعة باللغات الثلاث",
      },
      {
        en: "Duplicate a campaign, or move a scheduled one back to draft before anything is sent",
        fr: "Dupliquer une campagne, ou remettre en brouillon une campagne programmée avant tout envoi",
        ar: "نسخ حملة، أو إعادة حملة مجدولة إلى المسودات قبل إرسال أي رسالة",
      },
      {
        en: "A staff guide with screenshots, in English, for the front desk, managers and owners",
        fr: "Un guide illustré, en anglais, pour la réception, les responsables et les propriétaires",
        ar: "دليل مصوّر بالإنجليزية لموظفي الاستقبال والمديرين والمالكين",
      },
      {
        en: "This page: what we are working on and what each release changed",
        fr: "Cette page : ce que nous préparons et ce que chaque version a changé",
        ar: "هذه الصفحة: ما نعمل عليه وما غيّره كل إصدار",
      },
    ],
    improved: [
      {
        en: "Campaigns filtered by last stay also count recorded visits, and say how many guests are left out",
        fr: "Le filtre « dernier séjour » des campagnes compte aussi les visites enregistrées et indique combien de clients sont écartés",
        ar: "تصفية الحملات حسب آخر إقامة تحتسب الزيارات المسجلة أيضًا، وتبيّن عدد النزلاء المستثنين",
      },
      {
        en: "A CSV import shows who is new and who is already on your list before you confirm",
        fr: "L'import CSV montre avant validation qui est nouveau et qui figure déjà dans votre liste",
        ar: "يُظهر استيراد ملف CSV قبل التأكيد من هو جديد ومن هو مسجل في قائمتكم",
      },
      {
        en: "Stronger sign-in and invitation security",
        fr: "Connexion et invitations mieux sécurisées",
        ar: "حماية أقوى لتسجيل الدخول والدعوات",
      },
    ],
    fixed: [
      {
        en: "CSV import asks for email and WhatsApp consent in separate columns and reads French headings and answers",
        fr: "L'import CSV lit l'accord e-mail et l'accord WhatsApp dans des colonnes séparées, avec des titres et réponses en français",
        ar: "يقرأ استيراد CSV موافقة البريد وموافقة واتساب من عمودين منفصلين، ويفهم العناوين والإجابات بالفرنسية",
      },
      {
        en: "Offer and unsubscribe links now open in French and Arabic",
        fr: "Les liens d'offre et de désabonnement s'ouvrent désormais en français et en arabe",
        ar: "أصبحت روابط العروض وإلغاء الاشتراك تُفتح بالفرنسية والعربية",
      },
      {
        en: "Clearer wording and display for message names, scheduled campaigns, phone numbers and charts on phones",
        fr: "Libellés et affichage plus clairs pour les noms de messages, les campagnes programmées, les numéros et les graphiques sur téléphone",
        ar: "صياغة وعرض أوضح لأسماء الرسائل والحملات المجدولة وأرقام الهاتف والرسوم البيانية على الهاتف",
      },
    ],
  },
  {
    version: "0.5.0",
    summary: {
      en: "Print your QR codes properly, find any guest fast, and see who did what. Plus many sign-up and daily-use fixes.",
      fr: "Imprimez proprement vos codes QR, retrouvez un client vite et voyez qui a fait quoi. Avec de nombreuses corrections à l'inscription et au quotidien.",
      ar: "اطبعوا رموز QR بشكل متقن، واعثروا على أي نزيل بسرعة، واعرفوا من قام بماذا. مع إصلاحات كثيرة للتسجيل والاستخدام اليومي.",
    },
    added: [
      {
        en: "A printable QR kit: room cards, table tents, desk signs and stickers, for your own printer or a print shop",
        fr: "Un kit QR à imprimer : cartes de chambre, chevalets de table, affiches de comptoir et autocollants, sur votre imprimante ou chez un imprimeur",
        ar: "مجموعة QR للطباعة: بطاقات الغرف، وحوامل الطاولات، ولافتات الاستقبال، والملصقات، على طابعتكم أو في مطبعة",
      },
      {
        en: "A short web address printed with each code, for cameras that fail",
        fr: "Une adresse courte imprimée avec chaque code, si l'appareil photo ne lit pas",
        ar: "عنوان ويب قصير مطبوع مع كل رمز في حال تعذّرت قراءته بالكاميرا",
      },
      {
        en: "Guests can scan, write to the hotel on WhatsApp and get an automatic welcome reply",
        fr: "Le client peut scanner, écrire à l'hôtel sur WhatsApp et recevoir une réponse de bienvenue automatique",
        ar: "يمكن للنزيل مسح الرمز ومراسلة الفندق على واتساب وتلقي رد ترحيبي تلقائي",
      },
      {
        en: "Guest search by name or phone from the top bar",
        fr: "Recherche d'un client par nom ou téléphone depuis la barre du haut",
        ar: "البحث عن نزيل بالاسم أو الهاتف من الشريط العلوي",
      },
      {
        en: "A Mark visit button that records returning guests",
        fr: "Un bouton pour noter une visite et reconnaître les clients qui reviennent",
        ar: "زر لتسجيل الزيارة والتعرف على النزلاء العائدين",
      },
      {
        en: "An activity log for owners and managers, and a first-steps checklist on the home page",
        fr: "Un journal d'activité pour les propriétaires et responsables, et une liste des premiers pas sur la page d'accueil",
        ar: "سجل نشاط للمالكين والمديرين، وقائمة بالخطوات الأولى في الصفحة الرئيسية",
      },
    ],
    improved: [
      {
        en: "The QR codes page is built around printing, with a preview that matches the print",
        fr: "La page des codes QR est organisée autour de l'impression, avec un aperçu fidèle",
        ar: "صفحة رموز QR أصبحت مبنية حول الطباعة، مع معاينة مطابقة للمطبوع",
      },
      {
        en: "Long lists load more as you scroll",
        fr: "Les longues listes se chargent au fil du défilement",
        ar: "القوائم الطويلة تُحمّل المزيد أثناء التمرير",
      },
      {
        en: "Guests can enter international phone numbers and are asked when they leave, so the survey arrives after the stay",
        fr: "Les clients peuvent saisir un numéro étranger et indiquer leur départ, pour recevoir l'enquête après le séjour",
        ar: "يمكن للنزلاء إدخال أرقام دولية، ويُسألون عن موعد المغادرة ليصلهم الاستبيان بعد الإقامة",
      },
      {
        en: "The thank-you screen shows the welcome offer code right away",
        fr: "L'écran de remerciement affiche tout de suite le code de l'offre de bienvenue",
        ar: "تعرض شاشة الشكر رمز عرض الترحيب مباشرة",
      },
      {
        en: "Staff can give an offer to a guest, and correct a guest's phone number",
        fr: "L'équipe peut remettre une offre à un client et corriger son numéro de téléphone",
        ar: "يمكن للموظفين منح عرض لنزيل وتصحيح رقم هاتفه",
      },
      {
        en: "Stronger sign-in and invitation security",
        fr: "Connexion et invitations mieux sécurisées",
        ar: "حماية أقوى لتسجيل الدخول والدعوات",
      },
    ],
    fixed: [
      {
        en: "Guests see what they agree to before joining, and success only shows once the sign-up reached us",
        fr: "Le client voit ce qu'il accepte avant de s'inscrire, et la confirmation n'apparaît qu'une fois l'inscription reçue",
        ar: "يرى النزيل ما يوافق عليه قبل الانضمام، ولا يظهر التأكيد إلا بعد وصول التسجيل",
      },
      {
        en: "Many guests on the same hotel Wi-Fi can sign up",
        fr: "De nombreux clients sur le même Wi-Fi de l'hôtel peuvent s'inscrire",
        ar: "يستطيع عدد كبير من النزلاء على شبكة الفندق نفسها التسجيل",
      },
      {
        en: "A WhatsApp STOP is honoured even when WhatsApp does not share the guest's number",
        fr: "Un STOP sur WhatsApp est respecté même quand WhatsApp ne transmet pas le numéro",
        ar: "يُحترم طلب الإيقاف (STOP) على واتساب حتى عندما لا يشارك واتساب رقم النزيل",
      },
      {
        en: "Switching hotels, team lists and invited owners joining work as expected, and pages follow your role",
        fr: "Le changement d'hôtel, la liste de l'équipe et l'arrivée des propriétaires invités fonctionnent, et les pages suivent votre rôle",
        ar: "أصبح التبديل بين الفنادق وقائمة الفريق وانضمام المالكين المدعوين يعمل كما يجب، والصفحات تتبع صلاحياتكم",
      },
    ],
  },
  {
    version: "0.4.1",
    summary: {
      en: "A privacy fix for the product feedback form.",
      fr: "Une correction de confidentialité pour le formulaire de retour sur le produit.",
      ar: "إصلاح يخص الخصوصية في نموذج إرسال ملاحظاتكم حول المنتج.",
    },
    fixed: [
      {
        en: "Emails, phone numbers and links are removed from product feedback before it is filed",
        fr: "Les e-mails, numéros et liens sont retirés de vos retours sur le produit avant leur enregistrement",
        ar: "تُحذف عناوين البريد وأرقام الهاتف والروابط من ملاحظاتكم حول المنتج قبل تسجيلها",
      },
    ],
  },
  {
    version: "0.4.0",
    summary: {
      en: "Owners get a summary of their week without opening the dashboard.",
      fr: "Les propriétaires reçoivent le résumé de leur semaine sans ouvrir le tableau de bord.",
      ar: "يصل المالكين ملخص أسبوعهم دون فتح لوحة التحكم.",
    },
    added: [
      {
        en: "A weekly email to owners on Monday, which can be turned off in the hotel settings",
        fr: "Un e-mail hebdomadaire aux propriétaires le lundi, désactivable dans les réglages de l'hôtel",
        ar: "رسالة أسبوعية للمالكين يوم الإثنين، يمكن إيقافها من إعدادات الفندق",
      },
    ],
  },
  {
    version: "0.3.0",
    summary: {
      en: "Unhappy guests get their own follow-up list, so none is forgotten.",
      fr: "Les clients mécontents ont leur propre liste de suivi, pour n'en oublier aucun.",
      ar: "أصبحت للنزلاء غير الراضين قائمة متابعة خاصة حتى لا يُنسى أحد.",
    },
    added: [
      {
        en: "A feedback inbox for low survey scores, with a status and a shared team note per case",
        fr: "Une boîte des avis négatifs, avec un statut et une note d'équipe par cas",
        ar: "صندوق للتقييمات المنخفضة، مع حالة متابعة وملاحظة مشتركة للفريق لكل حالة",
      },
    ],
  },
  {
    version: "0.2.1",
    summary: {
      en: "A clearer consent record and work behind the scenes.",
      fr: "Un historique des accords plus précis et du travail en coulisses.",
      ar: "سجل موافقات أوضح وأعمال خلف الكواليس.",
    },
    improved: [
      {
        en: "The consent history keeps which staff member recorded a change",
        fr: "L'historique des accords garde le nom du membre de l'équipe qui a saisi le changement",
        ar: "يحفظ سجل الموافقات الموظف الذي سجّل التغيير",
      },
    ],
  },
  {
    version: "0.2.0",
    summary: {
      en: "Maintenance behind the scenes. Nothing changes in your daily use.",
      fr: "Maintenance en coulisses. Rien ne change dans votre usage quotidien.",
      ar: "أعمال صيانة خلف الكواليس. لا تغيير في استخدامكم اليومي.",
    },
  },
  {
    version: "0.1.3",
    summary: {
      en: "One place for manager alerts: email.",
      fr: "Un seul canal pour les alertes aux responsables : l'e-mail.",
      ar: "قناة واحدة لتنبيهات المدير: البريد الإلكتروني.",
    },
    removed: [
      {
        en: "Manager alerts by Telegram. Alerts go by email",
        fr: "Les alertes aux responsables par Telegram. Elles arrivent par e-mail",
        ar: "تنبيهات المدير عبر تيليغرام. تصل التنبيهات بالبريد الإلكتروني",
      },
    ],
  },
  {
    version: "0.1.2",
    summary: {
      en: "Maintenance behind the scenes. Nothing changes in your daily use.",
      fr: "Maintenance en coulisses. Rien ne change dans votre usage quotidien.",
      ar: "أعمال صيانة خلف الكواليس. لا تغيير في استخدامكم اليومي.",
    },
  },
  {
    version: "0.1.1",
    summary: {
      en: "Maintenance behind the scenes. Nothing changes in your daily use.",
      fr: "Maintenance en coulisses. Rien ne change dans votre usage quotidien.",
      ar: "أعمال صيانة خلف الكواليس. لا تغيير في استخدامكم اليومي.",
    },
  },
  {
    version: "0.1.0",
    summary: {
      en: "The first version: guests join by QR code, you keep your own guest list, and you hear about a bad stay early.",
      fr: "La première version : les clients s'inscrivent par code QR, la liste clients vous appartient et vous apprenez tôt qu'un séjour s'est mal passé.",
      ar: "الإصدار الأول: ينضم النزلاء عبر رمز QR، وقائمة النزلاء ملككم، وتعرفون مبكرًا بالإقامة غير المرضية.",
    },
    added: [
      {
        en: "A sign-up page by QR code with your logo and colors, and consent asked for each channel",
        fr: "Une page d'inscription par code QR à votre logo et vos couleurs, avec un accord demandé pour chaque canal",
        ar: "صفحة تسجيل عبر رمز QR بشعاركم وألوانكم، مع طلب الموافقة لكل قناة",
      },
      {
        en: "Your guest list, with quick add at the front desk, CSV import, export and delete",
        fr: "Votre liste clients, avec ajout rapide à la réception, import CSV, export et suppression",
        ar: "قائمة نزلائكم، مع إضافة سريعة من الاستقبال، واستيراد CSV، والتصدير والحذف",
      },
      {
        en: "Recognition of returning guests at the front desk",
        fr: "La reconnaissance des clients de retour à la réception",
        ar: "التعرف على النزلاء العائدين في الاستقبال",
      },
      {
        en: "Offers with a code and QR that staff redeem",
        fr: "Des offres avec code et QR que l'équipe valide",
        ar: "عروض برمز وQR يتحقق منها الموظفون",
      },
      {
        en: "Welcome, birthday and holiday messages, and campaigns, by email and WhatsApp, each with unsubscribe or STOP",
        fr: "Messages de bienvenue, d'anniversaire et de fêtes, et campagnes, par e-mail et WhatsApp, toujours avec désabonnement ou STOP",
        ar: "رسائل ترحيب وأعياد ميلاد ومناسبات، وحملات، عبر البريد وواتساب، مع إمكانية إلغاء الاشتراك أو STOP دائمًا",
      },
      {
        en: "A short survey after the stay, an alert when a score is low, and a Google review invite for every guest who answers",
        fr: "Une courte enquête après le séjour, une alerte si la note est basse et une invitation à un avis Google pour chaque client qui répond",
        ar: "استبيان قصير بعد الإقامة، وتنبيه عند انخفاض التقييم، ودعوة لتقييم على Google لكل نزيل يجيب",
      },
      {
        en: "Results at a glance, and everything in English, French and Arabic",
        fr: "Les résultats en un coup d'œil, et tout en français, anglais et arabe",
        ar: "النتائج بنظرة واحدة، وكل شيء بالعربية والفرنسية والإنجليزية",
      },
    ],
  },
]
