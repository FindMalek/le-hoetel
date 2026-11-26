import type { HotelLanguage } from "@ritorno/common/hotel"

type Comments = Record<HotelLanguage, string[]>

export const GOOD_COMMENTS: Comments = {
  en: [
    "Perfect stay, the staff were lovely.",
    "Spotless room and a generous breakfast.",
    "Beautiful view, we will be back with the family.",
    "Warm welcome, thank you to the whole team.",
    "The pool area was calm and very clean.",
    "Dinner on the terrace was the highlight of our trip.",
    "Check-in took two minutes, great job.",
    "Quiet nights and a very comfortable bed.",
    "The kids loved it, the animation team was fantastic.",
    "Best brik we had in Tunisia. See you next summer.",
  ],
  fr: [
    "Séjour parfait, le personnel est adorable.",
    "Chambre très propre et petit-déjeuner généreux.",
    "Vue magnifique, nous reviendrons en famille.",
    "Accueil chaleureux, merci à toute l'équipe.",
    "Le spa est un vrai moment de détente.",
    "Le dîner sur la terrasse était délicieux.",
    "Arrivée rapide et sans stress, bravo.",
    "Nuits très calmes et literie confortable.",
    "Les enfants ont adoré la piscine et l'animation.",
    "Un cadre charmant, on s'est sentis comme à la maison.",
  ],
  ar: [
    "إقامة رائعة والطاقم لطيف جدًا.",
    "الغرفة نظيفة والفطور ممتاز.",
    "المنظر جميل وسنعود مع العائلة.",
    "استقبال دافئ، شكرًا لكل الفريق.",
    "المسبح هادئ ونظيف جدًا.",
    "العشاء على السطح كان لذيذًا.",
    "تسجيل الوصول كان سريعًا وسهلًا.",
    "ليالٍ هادئة وسرير مريح.",
    "الأطفال استمتعوا كثيرًا، شكرًا لكم.",
    "مكان جميل أحسسنا فيه أننا في بيتنا.",
  ],
}

export const NEUTRAL_COMMENTS: Comments = {
  en: ["Nice stay overall, the wifi was slow.", "Good food, the room could use a refresh."],
  fr: [
    "Bon séjour dans l'ensemble, mais le wifi est lent.",
    "Bonne cuisine, la chambre mériterait un rafraîchissement.",
  ],
  ar: ["إقامة جيدة عمومًا لكن الإنترنت بطيء.", "الأكل جيد لكن الغرفة تحتاج إلى تجديد."],
}

export const BAD_COMMENTS: Comments = {
  en: [
    "The air conditioning did not work at night.",
    "Too long a wait at the front desk on arrival.",
    "Noise in the corridor until late.",
    "The bathroom was not clean enough when we arrived.",
    "No hot water two mornings in a row.",
    "Our room was not the one we booked.",
  ],
  fr: [
    "Le climatiseur de la chambre ne marchait pas la nuit.",
    "Attente trop longue à la réception à l'arrivée.",
    "Bruit dans le couloir jusqu'à tard.",
    "Salle de bain pas assez propre à notre arrivée.",
    "Pas d'eau chaude deux matins de suite.",
    "La chambre ne correspondait pas à la réservation.",
  ],
  ar: [
    "المكيف في الغرفة لم يكن يعمل ليلًا.",
    "انتظرنا طويلًا في الاستقبال عند الوصول.",
    "كان هناك ضجيج في الممر حتى وقت متأخر.",
    "الحمام لم يكن نظيفًا بما يكفي عند وصولنا.",
    "لم يكن هناك ماء ساخن صباحين متتاليين.",
    "الغرفة لم تكن مطابقة للحجز.",
  ],
}

/** What the manager wrote on a case, in the hotel's language. Never a name or a number. */
export const CASE_NOTES: Record<"contacted" | "resolved", Comments> = {
  contacted: {
    en: [
      "Called back, waiting for their answer.",
      "Sent an apology, maintenance is checking the room.",
      "Left a message, will try again tomorrow morning.",
    ],
    fr: [
      "Rappelé, en attente de sa réponse.",
      "Excuses envoyées, la maintenance vérifie la chambre.",
      "Message laissé, nouvel essai demain matin.",
    ],
    ar: ["اتصلنا وننتظر الرد.", "أرسلنا اعتذارًا والصيانة تفحص الغرفة.", "تركنا رسالة وسنعيد المحاولة غدًا."],
  },
  resolved: {
    en: [
      "Offered a free dinner, guest was happy.",
      "Fixed the unit and moved them to a sea view room.",
      "Spoke with housekeeping, checklist updated.",
    ],
    fr: [
      "Dîner offert, le client était satisfait.",
      "Appareil réparé et client déplacé en chambre vue mer.",
      "Point fait avec le ménage, la checklist est à jour.",
    ],
    ar: [
      "قدمنا عشاءً مجانيًا والضيف راضٍ.",
      "أصلحنا الجهاز ونقلناه إلى غرفة مطلة على البحر.",
      "تحدثنا مع فريق التنظيف وحدثنا القائمة.",
    ],
  },
}
