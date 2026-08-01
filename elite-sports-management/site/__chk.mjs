
{
  "@context": "https://schema.org",
  "@type": "SportsOrganization",
  "name": "Elite Sports Management",
  "alternateName": "ESM",
  "url": "https://elite-sports-management.vercel.app/",
  "logo": "https://elite-sports-management.vercel.app/logo.png",
  "image": "https://elite-sports-management.vercel.app/media/photos/twl-champions.jpg",
  "description": "Baseball and softball athlete representation and development — college recruiting, independent pro ball, winter leagues and Europe.",
  "sport": ["Baseball", "Softball"],
  "founder": { "@type": "Person", "name": "Samuele Bruno" },
  "sameAs": ["https://instagram.com/elite_sports_management__"],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer service",
    "email": "elitesportsmanagement50@gmail.com",
    "availableLanguage": ["English", "Spanish", "Italian"]
  }
}

;

/* ===== CONFIG: Supabase (live roster + applications) =====
   The anon key is browser-safe: RLS only allows reading approved players and
   inserting applications as `pending`. If Supabase is unreachable the site
   falls back to the embedded PLAYERS list below so it still renders offline. */
const SUPABASE_URL = "https://sbexwyvsgqayxrsrlrpm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiZXh3eXZzZ3FheXhyc3JscnBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NjY5NTYsImV4cCI6MjA5NjA0Mjk1Nn0.PWBwZ0oEYvQeA_ZMdahRA9cVqQv27fwN-1npU1XqTdw";

/* ===== CONFIG: Stripe Payment Links =====
   Create these in the Stripe Dashboard (see STRIPE-SETUP.md) and paste the URLs
   here. Until they're filled in, the pay buttons fall back to emailing ESM, so
   nothing on the site is a dead end. */
const STRIPE_ROSTER_URL   = "";   // $49.99 — lifetime roster access (scouts & teams)
const PAYPAL_PROFILE_URL  = "https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=brunosamuele56@gmail.com&currency_code=EUR&amount=124.99&item_name=ESM%20Player%20Profile";   // €124.99 profile creation — Sam's PayPal
const STRIPE_REGISTER_URL = "";   // $125   — athlete registration
const STRIPE_COLLEGE_URL  = "";   // college placement — price TBD
const FALLBACK_EMAIL      = "mailto:elitesportsmanagement50@gmail.com";

/* Contact: a scout who bought roster access already paid, so the profile just
   puts them in touch. If you ever want a separate per-player contact fee, put a
   Stripe link in STRIPE_CONTACT_URL and the button starts charging again. */
const STRIPE_CONTACT_URL = "";

/* ===== Roster access code =====
   The roster is gated client-side. We store the SHA-256 of each valid code, so
   the code itself isn't sitting in plain sight in the page source.
   Current code: ESM-SCOUT-2026   (to change it, see STRIPE-SETUP.md)
   Honest limits: this stops casual sharing, not a determined person. The player
   HTML still ships to the browser. Move to real logins when revenue justifies it. */
const ROSTER_CODE_HASHES = ["99b2bfb3a4ac35e32491d22207e082500404dbbd30f0cd8a5152cd6185c3cc58"];
const UNLOCK_KEY = "esm_roster_unlock_v1";
/* Profile-creation gate — SEPARATE code + key from the roster gate (no collision).
   Current code: ESM-PROFILE-2026 (SHA-256 below). Change the code by replacing the hash. */
const PROFILE_CODE_HASHES = ["e15bc2cb66c49eed1616431667ec0f6911edf2d11624a296b38e7255497198f3"];
const PROFILE_UNLOCK_KEY = "esm_profile_unlock_v1";

/* ===== Media (Tenerife Winter League) ===== */
const GALLERY = [
  {f:"twl-field-aerial",  c:"The seaside field — Tenerife"},
  {f:"twl-champions",     c:"Champions — Tenerife Winter League"},
  {f:"twl-allstars-team", c:"All-Stars — Tenerife"},
  {f:"twl-trophy-pair",   c:"Trophy night"},
  {f:"twl-medal",         c:"Medal ceremony"},
  {f:"twl-huddle-2",      c:"Pregame huddle"},
  {f:"twl-mound-visit",   c:"Mound visit"},
  {f:"twl-on-deck",       c:"On deck"},
  {f:"twl-teammates",     c:"Teammates"},
  {f:"twl-infield",       c:"Infield talk"},
  {f:"twl-batter-13",     c:"At the plate"},
  {f:"twl-huddle-1",      c:"Team meeting"}
];
const CLIPS = [1,2,3,4,5,6,7,8,9];

/* Player photos committed to the repo. A Supabase `image_url` always wins. */
const LOCAL_PHOTOS = { "jose-cedeno":"media/photos/jose-cedeno.jpg" };

/* ===== EVENTS ===== */
const EVENTS = [
  { title:"Winter League 2026", date:"2026-12-08", loc:"Tenerife, Spain", status:"upcoming", media:true, icon:"🏝️", image:"media/photos/twl-field-aerial-thumb.jpg", blurb:"Adult division winter league on the coast of Tenerife, Spain — Dec 8–15, 2026. Includes tournament entry, hotel with meals, transport to the seaside field, official jersey and cap, laundry service, and a showcase in front of MLB and college scouts. Registration is open; the first 20 players to sign up get a bonus surprise.", tags:"⚾ Adult Division  ·  🔭 MLB & College Scouts  ·  🎁 First 20 get a bonus", email:"elitesportsmanagement50@gmail.com" }
];

/* ===== TESTIMONIALS =====
   José's words are quoted in his own Spanish under q.es; q.en / q.it are
   translations so the card reads naturally in every language. */
const TESTIMONIALS = [
  {
    q:{
      es:"Agradezco mucho a la agencia Elite Sports Management y a Samuele Bruno por ayudarme a conseguir oportunidades y por hacerme creer en mi talento. 100% recomendado — excelente agencia y excelente persona, todo un profesional en lo que haces. Dios te bendiga grandemente, hermano. Bendiciones.",
      en:"I'm deeply grateful to Elite Sports Management and to Samuele Bruno for helping me find opportunities and for making me believe in my talent. 100% recommended — an excellent agency and an excellent person, a true professional in what you do. God bless you greatly, brother. Blessings.",
      it:"Ringrazio moltissimo l'agenzia Elite Sports Management e Samuele Bruno per avermi aiutato a trovare opportunità e per avermi fatto credere nel mio talento. 100% raccomandato — ottima agenzia e ottima persona, un vero professionista in quello che fai. Dio ti benedica, fratello. Benedizioni."
    },
    n:"José Cedeño",
    r:{ en:"Former Cleveland Indians organization", es:"Ex organización de los Cleveland Indians", it:"Ex organizzazione Cleveland Indians" },
    photo:"media/photos/jose-cedeno-thumb.jpg"
  }
];

/* Players with a real static profile page at players/<slug>.html (built via
   gen_player_pages.py). Anyone not in this set falls back to the in-page modal
   -- e.g. new applicants approved via the Join form before pages are regenerated. */
const STATIC_PLAYER_PAGES = new Set(["brayan-hernandez", "gianni-westphal", "jose-cedeno", "danyer-sanabria", "francesco-mazzei", "anderson-pena", "jesus-delgado", "lorenzo-gonzalez", "jaider-morelos", "bret-bowers", "osiris-german", "adam-moser", "yerardo-ciofani", "javier-useche", "david-chavez", "matteo-colalucci", "anthony-quattrocchi"]);

const T = {
  en:{nav_about:"What We Do",nav_college:"College",nav_who:"Who I Am",nav_roster:"Roster",nav_events:"Events",nav_media:"Media",nav_join:"Join Us",nav_signin:"Sign In",nav_signin_create:"Create Account",nav_signin_player:"Player Portal",nav_signin_scout:"Scout Portal",nav_signin_admin:"Admin Portal",nav_cta:"Apply Now",
    contracts_h2:'50+ contracts signed <em>since 2025</em>',
    contracts_sub:'Our athletes have signed contracts in <b>7 different countries</b> to date.',
    feat_role:"Former Cleveland Indians organization",
    col_kicker:"College Placement",col_h2:"Get recruited. Get a scholarship.",
    col_p:"We guide baseball and softball athletes through the U.S. college recruiting process from first evaluation to signed offer — NCAA, NAIA and JUCO.",
    col_1:"An honest evaluation of where your game realistically fits — Division I through JUCO.",
    col_2:"A recruiting profile and highlight reel built around what college coaches actually watch for.",
    col_3:"Direct outreach to coaches, with the follow-up handled for you.",
    col_4:"Eligibility and academics — NCAA/NAIA registration, transcripts, test requirements.",
    col_5:"Offer and scholarship guidance, so you can compare deals instead of guessing.",
    col_6:"For international athletes: visa, transition and arrival support once you commit.",
    col_cta_h:"Start your college recruiting",
    col_cta_p:"Tell us about your game and we'll come back with an honest read on your options.",
    col_price:"Pricing on request",col_cta_btn:"Get started →",
    gate_h:"The roster is for scouts & teams",
    gate_p:"Unlock every ESM athlete — full profiles, career history and playing experience.",
    gate_price_note:"One-time · Lifetime access",
    gate_btn:"Unlock the roster — $49.99",
    gate_or:"Already paid?",gate_unlock:"Unlock",
    gate_err:"That code isn't right. Check the email from your purchase, or contact us.",
    gate_unlocked:"Roster unlocked — thanks for your support.",
    pg_kicker:"Create Your Profile",pg_h2:"Get Represented by ESM",pg_p2:"Create your official athlete profile and start your journey with Elite Sports Management.",
    pg_h:"Create Your Player Profile",pg_p:"To create your official ESM athlete profile, send €124.99 via PayPal to brunosamuele56@gmail.com. We'll email you an access code — enter it below to continue to your application.",
    pg_price_note:"One-time · Profile creation",pg_btn:"Pay €124.99 with PayPal",pg_or:"Already paid? Enter your code",pg_unlock:"Unlock",
    pg_err:"That code isn't right. Check the email from your purchase, or contact us.",
    pg_done_h:"You're all set!",pg_done_p:"Your access is unlocked. Complete the application form to create your athlete profile.",pg_done_btn:"Continue to your application →",
    pay_h:"One last step",
    pay_p:"We've got your application. Complete your $125 registration and Samuele will review your profile.",
    pay_btn:"Complete registration — $125",
    pay_fine:"Your application is already saved. You can pay now or from the confirmation email.",
    media_kicker:"Media",media_h2:"On the field",
    media_p:"Clips and photos from the Tenerife Winter League and ESM events.",
    media_video_label:"Video",media_photo_label:"Photos",
    hero_eyebrow:"Athlete Representation · Worldwide",hero_h1:'Representing the <em>next generation</em> of baseball and softball talent.',
    hero_lead:"Elite Sports Management guides baseball and softball athletes from the young to the pro ranks — across college, indy ball, winter league, Europe and Australia.",
    hero_btn1:"View the Roster",hero_btn2:"Register Here",
    stat1:"Athletes Represented",stat2:"Countries",stat3:"MLB Organizations",
    about_kicker:"What We Do",about_h2:"Full-service representation, built around the athlete.",
    about_p:"Our mission is to support baseball and softball athletes as they work to reach their full potential — on the field, in their careers and beyond.",
    svc1_t:"College Placement",svc1_d:"Connecting players with U.S. college programs and helping them earn athletic scholarships that fit their game, goals and budget.",svc1_pay:"Explore College Placement →",
    svc2_t:"Indy Ball",svc2_d:"Opening doors to professional independent leagues across North America.",svc2_pay:"Sign up for Indy Ball →",
    svc6_t:"Winter League",svc6_d:"Placing athletes in winter league play abroad for extra reps and exposure during the offseason.",svc6_pay:"Sign up for Winter League →",svc_pro_t:"Professional Leagues",svc_pro_d:"Opening doors to professional play — independent leagues in North America, winter leagues abroad, and clubs across Europe.",svc_pro_pay:"Explore Professional Leagues →",
    so_t:"Softball Opportunities",so_d:"Guiding softball athletes through college recruiting, national team pathways and international competition — with player development, showcase events and exposure to college coaches and scouts.",so_pay:"Explore Softball Opportunities →",    svc4_t:"Social Media & Branding",svc4_d:"Building each athlete's profile and story to grow their visibility.",
    svc5_t:"Representation & Development",svc5_d:"Day-to-day management and a plan tailored to each athlete.",svc5_pay:"Sign up for Representation →",svc5_hl_t:"Specialized Personalized Training",svc5_hl_d:"One-on-one and online coaching tailored to each athlete's game and goals.",
    who_kicker:"Who I Am",who_role:"CEO & Founder · Professional Baseball Player",
    who_bio:"Elite Sports Management was founded by Samuele Bruno — born and raised in Italy, and the first player born and raised in Italy to go on and play in the Canadian Baseball League. He came up through the Italian system, took silver with Italy at the U18 European Championship, and went on to wear the shirt of the Italian National Team. He played six seasons professionally in Italy, and earned a scholarship to play three years of college baseball in the United States.",
    who_bio2:"His own career ran through indy ball and winter leagues across North America and Australia — the same routes he now opens for ESM athletes. Beyond representation, Samuele runs camps, showcases and a coaching program built on one idea: train like an athlete, play like a pro.",
    cred_italy:"Italy National Team",cred_u18:"U18 European Championship · Silver",cred_cbl:"First Italian-raised player in the CBL",cred_pro:"6 Seasons Pro in Italy",cred_college:"U.S. College Scholarship",cred_hastings:"Hastings College · All-GPAC Honorable Mention",cred_cod:"College of the Desert · 3 HR in One Game",cred_ecc:"ECC College · Region 16 Champions",cred_util:"Professional Baseball Player",
    mz_role:"Softball Specialist",
    mz_bio:"NASM Certified Personal Trainer. Played JUCO softball at Eastern Arizona College before continuing her career at Texas A&M Kingsville, where she's studying Kinesiology – Performance Psychology and was named to the 2026 LSC All-Conference Tournament Team.",
    mz_bio2:"A three-time member of the Italian National Team, Marianna won silver with the U18 squad in 2021, silver again with the U22 squad in 2024, and gold in 2026 — becoming U22 European Champions.",
    mz_bio3:"She has competed in Italy's Serie A1, the country's highest level of softball, since 2020 and is entering her fourth season playing in the United States.",
    mz_cred1:"NASM Certified Personal Trainer",mz_cred2:"Italian National Team ×3",mz_cred3:"U22 European Champion · Gold 2026",mz_cred4:"LSC All-Conference Tournament Team 2026",mz_cred5:"Serie A1 · Italy's Top Level",mz_contact:"Contact Her",sam_contact:"Contact Him",
    roster_kicker:"The Roster",roster_h2:"Our Athletes",
    roster_p:"A growing family of ballplayers from the Dominican Republic, Venezuela, Spain, Colombia, Italy and the United States.",
    filter_all:"All",filter_pitcher:"Pitchers",filter_catcher:"Catchers",filter_infielder:"Infielders",filter_twoway:"Two-Way",card_view:"View profile →",
    events_kicker:"Events",events_h2:"Camps, Showcases & Tournaments",events_p:"Where Elite Sports Management athletes train, compete and get seen.",
    ev_upcoming:"Upcoming",ev_past:"Past",ev_register:"Register",ev_gallery:"View media & photos",
    testi_kicker:"Testimonials",testi_h2:"What People Say",testi_p:"Voices from players, families and coaches in the ESM family.",
    join_kicker:"Join Us",join_h2:"Apply to Elite Sports Management",join_p:"Players, families and clubs — tell us about yourself and we'll create your athlete profile.",
    join_tagline:"Train like an athlete. Play like a pro.",
    join_pitch:"Talent alone rarely opens the door. The right agent turns tryouts into contracts — negotiating your deals, opening leagues at home and abroad, and putting your name in front of the scouts and coaches who decide careers.",
    f_name:"Full name *",f_age:"Age",f_phone:"Phone number",f_email:"Email",f_ig:"Instagram profile",f_country:"Country",
    f_sport:"Sport",opt_baseball:"Baseball",opt_softball:"Softball",f_position:"Position",f_applying:"I'm applying for",opt_rep:"Representation",opt_rep_baseball:"Baseball Representation",opt_rep_softball:"Softball Representation",opt_college:"College Placement",opt_indy:"Indy Ball",opt_winter:"Winter League",opt_coach:"Coaching",opt_both:"Both",
    f_why:"Why do you want to start? / Your goals",f_other:"Anything else?",f_submit:"Submit application",
    f_success:"Thanks! Your application has been received — we'll review it and be in touch.",
    f_error:"Sorry, something went wrong sending your application. Please try again.",
    modal_highlights:"Career Highlights",modal_teams:"Teams & Affiliations",
    modal_contact_h:"Interested in this player?",modal_contact_p:"You have full roster access. Get in touch and we'll connect you with this athlete directly.",modal_contact_btn:"Contact ESM about this player",
    band_h2:"Are you the next great addition?",band_p:"Start the conversation with Elite Sports Management.",band_btn:"Apply Now",
    foot_tagline:"Join us in celebrating",foot_rights:"All rights reserved.",
    install_t:"Install the ESM app",install_d:"Add to your home screen",install_btn:"Install",
    admin_link:"Admin",login_h:"Admin Login",login_sub:"Manage athletes, stats & photos",login_email:"Email",login_pass:"Password",login_btn:"Log in"},
  es:{nav_about:"Qué Hacemos",nav_college:"College",nav_who:"Quién Soy",nav_roster:"Jugadores",nav_events:"Eventos",nav_media:"Media",nav_join:"Únete",nav_signin:"Entrar",nav_signin_create:"Crear Cuenta",nav_signin_player:"Portal Jugador",nav_signin_scout:"Portal Scout",nav_signin_admin:"Portal Admin",nav_cta:"Aplica Ahora",
    contracts_h2:'Más de 50 contratos firmados <em>desde 2025</em>',
    contracts_sub:'Nuestros atletas han firmado contratos en <b>7 países diferentes</b> hasta la fecha.',
    feat_role:"Ex organización de los Cleveland Indians",
    col_kicker:"Colocación en College",col_h2:"Que te recluten. Consigue tu beca.",
    col_p:"Acompañamos a atletas de béisbol y sóftbol en todo el proceso de reclutamiento universitario en EE. UU. — desde la primera evaluación hasta la oferta firmada. NCAA, NAIA y JUCO.",
    col_1:"Una evaluación honesta de dónde encaja tu nivel de verdad — de División I a JUCO.",
    col_2:"Un perfil de reclutamiento y un video de highlights hechos para lo que los coaches realmente miran.",
    col_3:"Contacto directo con los entrenadores, y el seguimiento lo hacemos nosotros.",
    col_4:"Elegibilidad y parte académica — registro NCAA/NAIA, expedientes, exámenes requeridos.",
    col_5:"Asesoría sobre ofertas y becas, para que compares y no adivines.",
    col_6:"Para atletas internacionales: visa, transición y apoyo a la llegada.",
    col_cta_h:"Empieza tu reclutamiento",
    col_cta_p:"Cuéntanos sobre tu juego y te damos una lectura honesta de tus opciones.",
    col_price:"Precio a consultar",col_cta_btn:"Empezar →",
    gate_h:"El roster es para scouts y equipos",
    gate_p:"Desbloquea a todos los atletas de ESM — perfiles completos, trayectoria y experiencia.",
    gate_price_note:"Pago único · Acceso de por vida",
    gate_btn:"Desbloquear el roster — $49.99",
    gate_or:"¿Ya pagaste?",gate_unlock:"Desbloquear",
    gate_err:"Ese código no es correcto. Revisa el correo de tu compra o contáctanos.",
    gate_unlocked:"Roster desbloqueado — gracias por tu apoyo.",
    pg_kicker:"Crea Tu Perfil",pg_h2:"Hazte Representar por ESM",pg_p2:"Crea tu perfil oficial de atleta y comienza tu camino con Elite Sports Management.",
    pg_h:"Crea Tu Perfil de Jugador",pg_p:"Para crear tu perfil oficial de atleta ESM, envía €124.99 por PayPal a brunosamuele56@gmail.com. Te enviaremos un código de acceso por correo — introdúcelo abajo para continuar con tu solicitud.",
    pg_price_note:"Pago único · Creación de perfil",pg_btn:"Paga €124.99 con PayPal",pg_or:"¿Ya pagaste? Introduce tu código",pg_unlock:"Desbloquear",
    pg_err:"Ese código no es correcto. Revisa el correo de tu compra o contáctanos.",
    pg_done_h:"¡Todo listo!",pg_done_p:"Tu acceso está desbloqueado. Completa el formulario para crear tu perfil de atleta.",pg_done_btn:"Continúa con tu solicitud →",
    pay_h:"Un último paso",
    pay_p:"Ya tenemos tu solicitud. Completa tu registro de $125 y Samuele revisará tu perfil.",
    pay_btn:"Completar registro — $125",
    pay_fine:"Tu solicitud ya está guardada. Puedes pagar ahora o desde el correo de confirmación.",
    media_kicker:"Media",media_h2:"En el terreno",
    media_p:"Videos y fotos de la Liga de Invierno de Tenerife y los eventos de ESM.",
    media_video_label:"Video",media_photo_label:"Fotos",
    hero_eyebrow:"Representación de Atletas · En Todo el Mundo",hero_h1:'Representando a la <em>nueva generación</em> del talento del béisbol y sóftbol.',
    hero_lead:"Elite Sports Management guía a los atletas de béisbol y sóftbol desde jóvenes hasta el profesionalismo — en el college, el indy ball, la liga de invierno, Europa y Australia.",
    hero_btn1:"Ver los Jugadores",hero_btn2:"Regístrate Aquí",
    stat1:"Atletas Representados",stat2:"Países",stat3:"Organizaciones MLB",
    about_kicker:"Qué Hacemos",about_h2:"Representación integral, centrada en el atleta.",
    about_p:"Nuestra misión es apoyar a los atletas de béisbol y sóftbol para que alcancen todo su potencial — dentro y fuera del terreno.",
    svc1_t:"Colocación en College",svc1_d:"Conectamos a los jugadores con programas universitarios en EE. UU. y les ayudamos a conseguir becas deportivas según su nivel, metas y presupuesto.",svc1_pay:"Ver Colocación en College →",
    svc2_t:"Indy Ball",svc2_d:"Abrimos puertas a las ligas profesionales independientes de Norteamérica.",svc2_pay:"Inscríbete en Indy Ball →",
    svc6_t:"Liga de Invierno",svc6_d:"Ubicamos atletas en ligas de invierno en el extranjero para sumar experiencia y visibilidad fuera de temporada.",svc6_pay:"Inscríbete en la Liga de Invierno →",svc_pro_t:"Ligas Profesionales",svc_pro_d:"Abrimos puertas al béisbol profesional — ligas independientes en Norteamérica, ligas de invierno en el extranjero y clubes por toda Europa.",svc_pro_pay:"Explora las Ligas Profesionales →",
    so_t:"Oportunidades de Sóftbol",so_d:"Acompañamos a las atletas de sóftbol en el reclutamiento universitario, las vías hacia las selecciones nacionales y la competición internacional — con desarrollo de jugadoras, showcases y visibilidad ante entrenadores y scouts.",so_pay:"Explora las Oportunidades de Sóftbol →",    svc4_t:"Redes Sociales y Marca",svc4_d:"Construimos el perfil y la historia de cada atleta para aumentar su visibilidad.",
    svc5_t:"Representación y Desarrollo",svc5_d:"Gestión diaria y un plan a la medida de cada atleta.",svc5_pay:"Inscríbete en Representación →",svc5_hl_t:"Entrenamiento Personalizado Especializado",svc5_hl_d:"Coaching individual y online adaptado al juego y los objetivos de cada atleta.",
    who_kicker:"Quién Soy",who_role:"CEO y Fundador · Jugador de Béisbol Profesional",
    who_bio:"Elite Sports Management fue fundada por Samuele Bruno — nacido y criado en Italia, y el primer jugador nacido y criado en Italia en llegar a jugar en la Canadian Baseball League. Se formó en el sistema italiano, fue subcampeón con Italia en el Campeonato Europeo Sub-18 y llegó a vestir la camiseta de la Selección Italiana. Jugó seis temporadas como profesional en Italia y obtuvo una beca para jugar tres años de béisbol universitario en Estados Unidos.",
    who_bio2:"Su propia carrera pasó por el indy ball y las ligas de invierno de Norteamérica y Australia — las mismas rutas que hoy abre para los atletas de ESM. Además de la representación, Samuele organiza camps, showcases y un programa de coaching con una sola idea: entrena como un atleta, juega como un profesional.",
    cred_italy:"Selección de Italia",cred_u18:"Campeonato Europeo Sub-18 · Plata",cred_cbl:"Primer italiano de formación en la CBL",cred_pro:"6 Temporadas Pro en Italia",cred_college:"Beca Universitaria en EE. UU.",cred_hastings:"Hastings College · Mención de Honor All-GPAC",cred_cod:"College of the Desert · 3 HR en un Partido",cred_ecc:"ECC College · Campeones de la Región 16",cred_util:"Jugador de Béisbol Profesional",
    mz_role:"Especialista en Softbol",
    mz_bio:"Entrenadora personal certificada por NASM. Jugó softbol JUCO en Eastern Arizona College antes de continuar su carrera en Texas A&M Kingsville, donde estudia Kinesiología – Psicología del Rendimiento y fue nombrada al Equipo All-Conference del Torneo LSC 2026.",
    mz_bio2:"Miembro de la Selección Nacional de Italia en tres ocasiones, Marianna ganó la medalla de plata con la selección U18 en 2021, plata nuevamente con la U22 en 2024 y oro en 2026, coronándose Campeona Europea U22.",
    mz_bio3:"Compite en la Serie A1 de Italia, la máxima categoría del país, desde 2020 y está por comenzar su cuarta temporada jugando en Estados Unidos.",
    mz_cred1:"Entrenadora Personal Certificada NASM",mz_cred2:"Selección de Italia ×3",mz_cred3:"Campeona Europea U22 · Oro 2026",mz_cred4:"Equipo All-Conference del Torneo LSC 2026",mz_cred5:"Serie A1 · Máxima Categoría de Italia",mz_contact:"Contáctala",sam_contact:"Contáctalo",
    roster_kicker:"Los Jugadores",roster_h2:"Nuestros Atletas",
    roster_p:"Una familia creciente de peloteros de República Dominicana, Venezuela, España, Colombia, Italia y Estados Unidos.",
    filter_all:"Todos",filter_pitcher:"Lanzadores",filter_catcher:"Receptores",filter_infielder:"Infielders",filter_twoway:"Dos Vías",card_view:"Ver perfil →",
    events_kicker:"Eventos",events_h2:"Camps, Showcases y Torneos",events_p:"Donde los atletas de Elite Sports Management entrenan, compiten y se hacen ver.",
    ev_upcoming:"Próximo",ev_past:"Pasado",ev_register:"Inscribirse",ev_gallery:"Ver fotos y videos",
    testi_kicker:"Testimonios",testi_h2:"Lo Que Dicen",testi_p:"Voces de jugadores, familias y entrenadores de la familia ESM.",
    join_kicker:"Únete",join_h2:"Aplica a Elite Sports Management",join_p:"Jugadores, familias y clubes — cuéntanos sobre ti y crearemos tu perfil de atleta.",
    join_tagline:"Entrena como un atleta. Juega como un profesional.",
    join_pitch:"El talento por sí solo casi nunca abre la puerta. El agente adecuado convierte las pruebas en contratos: negocia tus acuerdos, te abre ligas dentro y fuera del país y pone tu nombre frente a los scouts y entrenadores que deciden carreras.",
    f_name:"Nombre y apellido *",f_age:"Edad",f_phone:"Número de teléfono",f_email:"Correo electrónico",f_ig:"Perfil de Instagram",f_country:"País",
    f_sport:"Deporte",opt_baseball:"Béisbol",opt_softball:"Sóftbol",f_position:"Posición",f_applying:"Aplico para",opt_rep:"Representación",opt_rep_baseball:"Representación de Béisbol",opt_rep_softball:"Representación de Sóftbol",opt_college:"Colocación en College",opt_indy:"Indy Ball",opt_winter:"Liga de Invierno",opt_coach:"Coaching",opt_both:"Ambos",
    f_why:"¿Por qué quieres empezar? / Tus objetivos",f_other:"¿Algo más?",f_submit:"Enviar solicitud",
    f_success:"¡Gracias! Hemos recibido tu solicitud — la revisaremos y te contactaremos.",
    f_error:"Lo sentimos, hubo un problema al enviar tu solicitud. Inténtalo de nuevo.",
    modal_highlights:"Destacados de Carrera",modal_teams:"Equipos y Afiliaciones",
    modal_contact_h:"¿Interesado en este jugador?",modal_contact_p:"Tienes acceso completo al roster. Escríbenos y te conectamos directamente con este atleta.",modal_contact_btn:"Contactar a ESM sobre este jugador",
    band_h2:"¿Eres la próxima gran incorporación?",band_p:"Inicia la conversación con Elite Sports Management.",band_btn:"Aplica Ahora",
    foot_tagline:"Únete a celebrarlo",foot_rights:"Todos los derechos reservados.",
    install_t:"Instala la app de ESM",install_d:"Añádela a tu pantalla de inicio",install_btn:"Instalar",
    admin_link:"Admin",login_h:"Acceso Admin",login_sub:"Gestiona atletas, estadísticas y fotos",login_email:"Correo",login_pass:"Contraseña",login_btn:"Entrar"},
  it:{nav_about:"Cosa Facciamo",nav_college:"College",nav_who:"Chi Sono",nav_roster:"Roster",nav_events:"Eventi",nav_media:"Media",nav_join:"Unisciti",nav_signin:"Accedi",nav_signin_create:"Crea Account",nav_signin_player:"Portale Giocatore",nav_signin_scout:"Portale Scout",nav_signin_admin:"Portale Admin",nav_cta:"Candidati",
    contracts_h2:'Oltre 50 contratti firmati <em>dal 2025</em>',
    contracts_sub:'I nostri atleti hanno firmato contratti in <b>7 paesi diversi</b> a oggi.',
    feat_role:"Ex organizzazione Cleveland Indians",
    col_kicker:"Collocamento College",col_h2:"Fatti reclutare. Ottieni la borsa di studio.",
    col_p:"Accompagniamo gli atleti di baseball e softball in tutto il percorso di recruiting universitario negli USA — dalla prima valutazione all'offerta firmata. NCAA, NAIA e JUCO.",
    col_1:"Una valutazione onesta di dove il tuo livello si colloca davvero — dalla Division I alla JUCO.",
    col_2:"Un profilo di recruiting e un highlight video costruiti su ciò che i coach guardano davvero.",
    col_3:"Contatto diretto con i coach, con il follow-up gestito da noi.",
    col_4:"Eleggibilità e parte accademica — registrazione NCAA/NAIA, pagelle, test richiesti.",
    col_5:"Consulenza su offerte e borse di studio, così confronti invece di tirare a indovinare.",
    col_6:"Per gli atleti internazionali: visto, transizione e supporto all'arrivo.",
    col_cta_h:"Inizia il tuo recruiting",
    col_cta_p:"Raccontaci il tuo gioco e ti diamo una lettura onesta delle tue opzioni.",
    col_price:"Prezzo su richiesta",col_cta_btn:"Inizia →",
    gate_h:"Il roster è per scout e club",
    gate_p:"Sblocca tutti gli atleti ESM — profili completi, carriera ed esperienza.",
    gate_price_note:"Pagamento unico · Accesso a vita",
    gate_btn:"Sblocca il roster — $49.99",
    gate_or:"Hai già pagato?",gate_unlock:"Sblocca",
    gate_err:"Il codice non è corretto. Controlla l'email dell'acquisto o contattaci.",
    gate_unlocked:"Roster sbloccato — grazie del supporto.",
    pg_kicker:"Crea il Tuo Profilo",pg_h2:"Fatti Rappresentare da ESM",pg_p2:"Crea il tuo profilo ufficiale da atleta e inizia il tuo percorso con Elite Sports Management.",
    pg_h:"Crea il Tuo Profilo da Giocatore",pg_p:"Per creare il tuo profilo ufficiale da atleta ESM, invia €124.99 tramite PayPal a brunosamuele56@gmail.com. Ti invieremo un codice di accesso via email — inseriscilo qui sotto per continuare con la candidatura.",
    pg_price_note:"Pagamento unico · Creazione profilo",pg_btn:"Paga €124.99 con PayPal",pg_or:"Hai già pagato? Inserisci il codice",pg_unlock:"Sblocca",
    pg_err:"Codice non corretto. Controlla l'email del tuo acquisto o contattaci.",
    pg_done_h:"Tutto pronto!",pg_done_p:"Il tuo accesso è sbloccato. Completa il modulo per creare il tuo profilo da atleta.",pg_done_btn:"Continua con la candidatura →",
    pay_h:"Un ultimo passo",
    pay_p:"Abbiamo ricevuto la tua candidatura. Completa la registrazione da $125 e Samuele esaminerà il tuo profilo.",
    pay_btn:"Completa la registrazione — $125",
    pay_fine:"La tua candidatura è già salvata. Puoi pagare ora o dall'email di conferma.",
    media_kicker:"Media",media_h2:"Sul campo",
    media_p:"Video e foto dalla Winter League di Tenerife e dagli eventi ESM.",
    media_video_label:"Video",media_photo_label:"Foto",
    hero_eyebrow:"Rappresentanza Atleti · In Tutto il Mondo",hero_h1:'Rappresentiamo la <em>nuova generazione</em> del talento del baseball e softball.',
    hero_lead:"Elite Sports Management accompagna gli atleti di baseball e softball fin da giovani al professionismo — tra college, indy ball, winter league, Europa e Australia.",
    hero_btn1:"Vedi il Roster",hero_btn2:"Registrati Qui",
    stat1:"Atleti Rappresentati",stat2:"Paesi",stat3:"Organizzazioni MLB",
    about_kicker:"Cosa Facciamo",about_h2:"Rappresentanza completa, costruita intorno all'atleta.",
    about_p:"La nostra missione è supportare gli atleti di baseball e softball nel raggiungere il loro pieno potenziale — dentro e fuori dal campo.",
    svc1_t:"Collocamento College",svc1_d:"Mettiamo in contatto i giocatori con i programmi universitari USA e li aiutiamo a ottenere borse di studio sportive su misura per il loro livello, obiettivi e budget.",svc1_pay:"Scopri il Collocamento College →",
    svc2_t:"Indy Ball",svc2_d:"Apriamo le porte alle leghe professionistiche indipendenti del Nord America.",svc2_pay:"Iscriviti all'Indy Ball →",
    svc6_t:"Winter League",svc6_d:"Inseriamo gli atleti in campionati invernali all'estero per accumulare esperienza e visibilità durante la bassa stagione.",svc6_pay:"Iscriviti alla Winter League →",svc_pro_t:"Leghe Professionistiche",svc_pro_d:"Apriamo le porte al professionismo — leghe indipendenti in Nord America, winter league all'estero e club in tutta Europa.",svc_pro_pay:"Scopri le Leghe Professionistiche →",
    so_t:"Opportunità nel Softball",so_d:"Accompagniamo le atlete di softball nel recruiting universitario, nei percorsi verso le nazionali e nella competizione internazionale — con sviluppo delle giocatrici, showcase ed esposizione a coach e scout.",so_pay:"Scopri le Opportunità nel Softball →",    svc4_t:"Social Media e Brand",svc4_d:"Costruiamo il profilo e la storia di ogni atleta per aumentarne la visibilità.",
    svc5_t:"Rappresentanza e Sviluppo",svc5_d:"Gestione quotidiana e un piano su misura per ogni atleta.",svc5_pay:"Iscriviti alla Rappresentanza →",svc5_hl_t:"Allenamento Personalizzato Specializzato",svc5_hl_d:"Coaching individuale e online su misura per il gioco e gli obiettivi di ogni atleta.",
    who_kicker:"Chi Sono",who_role:"CEO e Fondatore · Giocatore di Baseball Professionista",
    who_bio:"Elite Sports Management è stata fondata da Samuele Bruno — nato e cresciuto in Italia, e il primo giocatore nato e cresciuto in Italia ad arrivare a giocare nella Canadian Baseball League. Cresciuto nel sistema italiano, ha conquistato l'argento con l'Italia al Campionato Europeo U18 ed è arrivato a vestire la maglia della Nazionale Italiana. Ha giocato sei stagioni da professionista in Italia e ha ottenuto una borsa di studio per giocare tre anni di baseball universitario negli Stati Uniti.",
    who_bio2:"La sua carriera è passata per l'indy ball e le winter league tra Nord America e Australia — le stesse strade che oggi apre agli atleti ESM. Oltre alla rappresentanza, Samuele organizza camp, showcase e un programma di coaching con un'unica idea: allenati come un atleta, gioca come un professionista.",
    cred_italy:"Nazionale Italiana",cred_u18:"Campionato Europeo U18 · Argento",cred_cbl:"Primo italiano di formazione nella CBL",cred_pro:"6 Stagioni Pro in Italia",cred_college:"Borsa di Studio negli USA",cred_hastings:"Hastings College · Menzione d'Onore All-GPAC",cred_cod:"College of the Desert · 3 HR in una Partita",cred_ecc:"ECC College · Campioni della Regione 16",cred_util:"Giocatore di Baseball Professionista",
    mz_role:"Specialista di Softball",
    mz_bio:"Personal trainer certificata NASM. Ha giocato softball JUCO all'Eastern Arizona College prima di proseguire la carriera alla Texas A&M Kingsville, dove studia Kinesiologia – Psicologia della Performance ed è stata inserita nella Tournament Team All-Conference LSC 2026.",
    mz_bio2:"Convocata tre volte nella Nazionale Italiana, ha conquistato l'argento con la U18 nel 2021, nuovamente l'argento con la U22 nel 2024 e l'oro nel 2026, laureandosi Campionessa Europea U22.",
    mz_bio3:"Gioca nella Serie A1, il massimo campionato italiano di softball, dal 2020 ed è pronta ad affrontare la sua quarta stagione negli Stati Uniti.",
    mz_cred1:"Personal Trainer Certificata NASM",mz_cred2:"Nazionale Italiana ×3",mz_cred3:"Campionessa Europea U22 · Oro 2026",mz_cred4:"Tournament Team All-Conference LSC 2026",mz_cred5:"Serie A1 · Massimo Campionato Italiano",mz_contact:"Contattala",sam_contact:"Contattalo",
    roster_kicker:"Il Roster",roster_h2:"I Nostri Atleti",
    roster_p:"Una famiglia in crescita di giocatori da Repubblica Dominicana, Venezuela, Spagna, Colombia, Italia e Stati Uniti.",
    filter_all:"Tutti",filter_pitcher:"Lanciatori",filter_catcher:"Ricevitori",filter_infielder:"Interni",filter_twoway:"Due Ruoli",card_view:"Vedi profilo →",
    events_kicker:"Eventi",events_h2:"Camp, Showcase e Tornei",events_p:"Dove gli atleti di Elite Sports Management si allenano, competono e si fanno notare.",
    ev_upcoming:"In arrivo",ev_past:"Passato",ev_register:"Iscriviti",ev_gallery:"Foto e video",
    testi_kicker:"Testimonianze",testi_h2:"Cosa Dicono",testi_p:"Le voci di giocatori, famiglie e coach della famiglia ESM.",
    join_kicker:"Unisciti",join_h2:"Candidati a Elite Sports Management",join_p:"Giocatori, famiglie e club — raccontaci di te e creeremo il tuo profilo da atleta.",
    join_tagline:"Allenati come un atleta. Gioca come un professionista.",
    join_pitch:"Il solo talento raramente apre le porte. L'agente giusto trasforma i provini in contratti: negozia i tuoi accordi, ti apre le leghe in patria e all'estero e mette il tuo nome davanti agli scout e agli allenatori che decidono le carriere.",
    f_name:"Nome e cognome *",f_age:"Età",f_phone:"Numero di telefono",f_email:"Email",f_ig:"Profilo Instagram",f_country:"Paese",
    f_sport:"Sport",opt_baseball:"Baseball",opt_softball:"Softball",f_position:"Ruolo",f_applying:"Mi candido per",opt_rep:"Rappresentanza",opt_rep_baseball:"Rappresentanza Baseball",opt_rep_softball:"Rappresentanza Softball",opt_college:"Collocamento College",opt_indy:"Indy Ball",opt_winter:"Winter League",opt_coach:"Coaching",opt_both:"Entrambi",
    f_why:"Perché vuoi iniziare? / I tuoi obiettivi",f_other:"Altro?",f_submit:"Invia candidatura",
    f_success:"Grazie! Abbiamo ricevuto la tua candidatura — la esamineremo e ti contatteremo.",
    f_error:"Spiacenti, qualcosa è andato storto nell'invio della candidatura. Riprova.",
    modal_highlights:"Carriera in Evidenza",modal_teams:"Squadre e Affiliazioni",
    modal_contact_h:"Interessato a questo giocatore?",modal_contact_p:"Hai accesso completo al roster. Scrivici e ti mettiamo in contatto direttamente con questo atleta.",modal_contact_btn:"Contatta ESM per questo atleta",
    band_h2:"Sei la prossima grande aggiunta?",band_p:"Inizia la conversazione con Elite Sports Management.",band_btn:"Candidati",
    foot_tagline:"Unisciti a festeggiare",foot_rights:"Tutti i diritti riservati.",
    install_t:"Installa l'app ESM",install_d:"Aggiungila alla schermata Home",install_btn:"Installa",
    admin_link:"Admin",login_h:"Accesso Admin",login_sub:"Gestisci atleti, statistiche e foto",login_email:"Email",login_pass:"Password",login_btn:"Accedi"}
};

const FLAGS={"Dominican Republic":"🇩🇴","República Dominicana":"🇩🇴","Repubblica Dominicana":"🇩🇴","Venezuela":"🇻🇪","Spain":"🇪🇸","España":"🇪🇸","Spagna":"🇪🇸","Colombia":"🇨🇴","Italy":"🇮🇹","Italia":"🇮🇹","United States":"🇺🇸","USA":"🇺🇸","Estados Unidos":"🇺🇸","Stati Uniti":"🇺🇸","Germany":"🇩🇪","Alemania":"🇩🇪","Germania":"🇩🇪","Portugal":"🇵🇹","Canada":"🇨🇦","Mexico":"🇲🇽","México":"🇲🇽"};

let PLAYERS = [
  {
    "slug": "brayan-hernandez",
    "sport": "Baseball",
    "name": "Brayan Hernández",
    "group": "Two-Way",
    "position": "Two-Way (C / 1B / OF)",
    "country": "Dominican Republic",
    "flag": "🇩🇴",
    "heritage": null,
    "born": "2001",
    "birthplace": "La Vega, Dominican Republic",
    "tier": "Pro",
    "bats": "Left",
    "bio": "A versatile two-way player out of La Vega known for his offensive power from the left side. Developed in the Baltimore Orioles organization, he can catch, play first base and patrol the outfield.",
    "teams": ["Baltimore Orioles org.", "Delmarva Shorebirds", "Aberdeen IronBirds"],
    "stats": []
  },
  {
    "slug": "gianni-westphal",
    "sport": "Baseball",
    "name": "Gianni Westphal",
    "group": "Pitcher",
    "position": "Pitcher (RHP)",
    "country": "Venezuela",
    "flag": "🇻🇪",
    "heritage": "🇩🇪",
    "born": "2001",
    "birthplace": "Caracas, Venezuela",
    "tier": "International",
    "bats": null,
    "bio": "A Venezuelan pitcher with German citizenship known for a 90 mph fastball and a deep repertoire of slider, sinker and changeup. Played in the German Bundesliga before signing in Italy's Serie B.",
    "teams": ["Dortmund Wanderers (GER)", "Livorno Baseball 1948 (ITA · Serie B)"],
    "stats": [{ "label": "Fastball", "value": "90 mph" }]
  },
  {
    "slug": "jose-cedeno",
    "sport": "Baseball",
    "name": "José Cedeño",
    "group": "Catcher",
    "position": "Catcher",
    "country": "Venezuela",
    "flag": "🇻🇪",
    "heritage": null,
    "born": null,
    "birthplace": "Venezuela",
    "tier": "Pro",
    "bats": null,
    "bio": "A talented catcher developed in the Cleveland Guardians organization after signing as an international prospect. Recognized for his defense behind the plate and a mature approach at a young age.",
    "teams": ["Cleveland Guardians org.", "Dominican Summer League", "Arizona Complex League"],
    "stats": []
  },
  {
    "slug": "danyer-sanabria",
    "sport": "Baseball",
    "name": "Danyer Sanabria",
    "group": "Infielder",
    "position": "Infielder",
    "country": "Venezuela",
    "flag": "🇻🇪",
    "heritage": null,
    "born": null,
    "birthplace": "Venezuela",
    "tier": "Pro",
    "bats": null,
    "bio": "A Venezuelan talent who has represented his country at the U23 level. Brings experience from affiliated ball plus winter leagues in Argentina and Venezuela and three seasons in Venezuela's Liga Mayor.",
    "teams": ["Arizona Diamondbacks org.", "Venezuela U23", "Liga Mayor (VEN)"],
    "stats": []
  },
  {
    "slug": "francesco-mazzei",
    "sport": "Baseball",
    "name": "Francesco Mazzei",
    "group": "Two-Way",
    "position": "Two-Way",
    "country": "Spain",
    "flag": "🇪🇸",
    "heritage": null,
    "born": null,
    "birthplace": "Madrid, Spain",
    "tier": "International",
    "bats": null,
    "bio": "A Spanish talent from Madrid who has represented Spain at both the U18 and U23 national-team levels. A standout in the Spanish baseball system pursuing the U.S. college route.",
    "teams": ["Spain National Team (U18 / U23)"],
    "stats": []
  },
  {
    "slug": "anderson-pena",
    "sport": "Baseball",
    "name": "Anderson Peña",
    "group": "Infielder",
    "position": "Infielder",
    "country": "Spain",
    "flag": "🇪🇸",
    "heritage": null,
    "born": "2006",
    "birthplace": "Spain",
    "tier": "International",
    "bats": null,
    "bio": "A Spanish infielder developed at the Regensburg Baseball Academy, known for strong defense and contact hitting. Has represented Spain internationally and is pursuing U.S. college baseball with pro potential.",
    "teams": ["Spain National Team", "Regensburg Baseball Academy"],
    "stats": []
  },
  {
    "slug": "jesus-delgado",
    "sport": "Baseball",
    "name": "Jesús Delgado",
    "group": "Pitcher",
    "position": "Pitcher (LHP)",
    "country": "Venezuela",
    "flag": "🇻🇪",
    "heritage": null,
    "born": "2003",
    "birthplace": "Guanare, Venezuela",
    "tier": "Pro",
    "bats": null,
    "bio": "A left-handed pitcher signed by the Texas Rangers in 2023 who has shown big projection in the minors. Shined as a 2024 DSL All-Star and continued his development in the Arizona Complex League.",
    "teams": ["Texas Rangers org.", "Arizona Complex League"],
    "stats": [
      { "label": "2024 DSL", "value": "All-Star" },
      { "label": "Strikeouts", "value": "83 in 64 IP" }
    ]
  },
  {
    "slug": "lorenzo-gonzalez",
    "sport": "Baseball",
    "name": "Lorenzo González",
    "group": "Catcher",
    "position": "Catcher",
    "country": "Venezuela",
    "flag": "🇻🇪",
    "heritage": null,
    "born": null,
    "birthplace": "Venezuela",
    "tier": "College",
    "bats": null,
    "bio": "A catcher at Campbellsville University whose game is built on consistent receiving, strong blocking and a quick release. Brings leadership and reliable game-calling behind the plate.",
    "teams": ["Campbellsville University (NAIA)"],
    "stats": []
  },
  {
    "slug": "jaider-morelos",
    "sport": "Baseball",
    "name": "Jaider Morelos",
    "group": "Infielder",
    "position": "Infielder",
    "country": "Colombia",
    "flag": "🇨🇴",
    "heritage": null,
    "born": null,
    "birthplace": "Colombia",
    "tier": "College",
    "bats": null,
    "bio": "A Colombian collegiate player competing at the NAIA level with Montreat College. Known for defensive consistency, versatility and a strong work ethic against high-level college talent.",
    "teams": ["Montreat College (NAIA)"],
    "stats": []
  },
  {
    "slug": "bret-bowers",
    "sport": "Baseball",
    "name": "Bret Bowers",
    "group": "Infielder",
    "position": "Infielder",
    "country": "United States",
    "flag": "🇺🇸",
    "heritage": null,
    "born": null,
    "birthplace": "United States",
    "tier": "College",
    "bats": null,
    "bio": "A collegiate player developed within the Campbellsville University program at the NAIA level. A member of the Tigers known for his work ethic and coachability against high-level competition.",
    "teams": ["Campbellsville University (NAIA)"],
    "stats": []
  },
  {
    "slug": "osiris-german",
    "sport": "Baseball",
    "name": "Osiris Germán",
    "group": "Pitcher",
    "position": "Pitcher (RHP)",
    "country": "Dominican Republic",
    "flag": "🇩🇴",
    "heritage": null,
    "born": null,
    "birthplace": "Dominican Republic",
    "tier": "Pro",
    "bats": null,
    "bio": "A professional Dominican pitcher developed in the Minnesota Twins organization after signing as an international free agent in 2016. Advanced to Double-A and earned MLB Spring Training invites with the Twins.",
    "teams": ["Minnesota Twins org.", "Wichita Wind Surge (AA)", "MLB Spring Training"],
    "stats": []
  },
  {
    "slug": "adam-moser",
    "sport": "Baseball",
    "name": "Adam Moser",
    "group": "Infielder",
    "position": "Infielder / Utility",
    "country": "United States",
    "flag": "🇺🇸",
    "heritage": null,
    "born": null,
    "birthplace": "Arizona, USA",
    "tier": "College",
    "bats": "Right",
    "bio": "An Arizona native and former Sunrise Mountain High School standout who went on to play infield at College of the Desert. A versatile utility player with elite hitting and an exciting power-and-defense profile.",
    "teams": ["Sunrise Mountain HS", "College of the Desert"],
    "stats": [
      { "label": "2024 AVG", "value": ".317" },
      { "label": "Home Runs", "value": "6" },
      { "label": "SLG", "value": ".545" }
    ]
  },
  {
    "slug": "yerardo-ciofani",
    "sport": "Baseball",
    "name": "Yerardo Ciofani",
    "group": "Pitcher",
    "position": "Pitcher (LHP)",
    "country": "Venezuela",
    "flag": "🇻🇪",
    "heritage": null,
    "born": "2006",
    "birthplace": "Maracaibo, Venezuela",
    "tier": "Pro",
    "bats": null,
    "bio": "A left-handed pitcher born in Maracaibo who signed with the Chicago White Sox in December 2023. Played for the DSL White Sox in 2024, posting a strong rookie campaign.",
    "teams": ["Chicago White Sox org.", "DSL White Sox"],
    "stats": [
      { "label": "2024 Record", "value": "5-1" },
      { "label": "Strikeouts", "value": "25" },
      { "label": "WHIP", "value": "2.16" }
    ]
  },
  {
    "slug": "javier-useche",
    "sport": "Baseball",
    "name": "José Javier Useche",
    "group": "Pitcher",
    "position": "Pitcher (RHP)",
    "country": "Venezuela",
    "flag": "🇻🇪",
    "heritage": "🇵🇹",
    "born": null,
    "birthplace": "Venezuela",
    "tier": "International",
    "bats": null,
    "bio": "A young Venezuelan-Portuguese right-hander who has stood out in Italy's Serie B with Porto Sant'Elpidio. Recognized for discipline, precision and competitive maturity, combining power with control.",
    "teams": ["Porto Sant'Elpidio (ITA · Serie B)"],
    "stats": []
  },
  {
    "slug": "david-chavez",
    "sport": "Baseball",
    "name": "David Chávez",
    "group": "Pitcher",
    "position": "Pitcher (RHP)",
    "country": "Venezuela",
    "flag": "🇻🇪",
    "heritage": null,
    "born": null,
    "birthplace": "Venezuela",
    "tier": "International",
    "bats": null,
    "bio": "A young right-handed pitcher active on the roster of a Serie A team in Italy. His place at a higher level positions him as a player with real growth potential on the Italian league's visibility window.",
    "teams": ["Serie A (Italy)"],
    "stats": []
  },
  {
    "slug": "matteo-colalucci",
    "sport": "Baseball",
    "name": "Matteo Colalucci",
    "group": "Two-Way",
    "position": "Pitcher / Infielder",
    "country": "Italy",
    "flag": "🇮🇹",
    "heritage": null,
    "born": "2004",
    "birthplace": "Anzio, Italy",
    "tier": "International",
    "bats": "Right",
    "bio": "An Italian pitcher and infielder who has played in Serie A and helped earn promotion to Serie B in 2025. Won a silver medal with Italy's U15 national team at the European Championship.",
    "teams": ["Serie A / Serie B (Italy)", "Italy U15 National Team"],
    "stats": [{ "label": "U15 Euros", "value": "🥈 Silver" }]
  },
  {
    "slug": "anthony-quattrocchi",
    "sport": "Baseball",
    "name": "Anthony Quattrocchi",
    "group": "Pitcher",
    "position": "Pitcher (RHP)",
    "country": "United States",
    "flag": "🇺🇸",
    "heritage": null,
    "born": null,
    "birthplace": "Surprise, Arizona, USA",
    "tier": "Pro",
    "bats": null,
    "bio": "A right-handed pitcher recognized for velocity and precision. Set the school strikeout record at Ottawa University Arizona and earned NCCAA First Team All-American honors before advancing to the pro independent leagues.",
    "teams": ["Ottawa University AZ", "Lake Erie (Frontier)", "Staten Island FerryHawks (Atlantic)", "Idaho Falls Chukars (Pioneer)"],
    "stats": [
      { "label": "College", "value": "7-2, 2.55 ERA" },
      { "label": "Strikeouts", "value": "83 (school record)" },
      { "label": "2021", "value": "NCCAA 1st Team A-A" }
    ]
  }
];
let lang="en", active="All", activeSport="All", SB=null;

const initials=n=>n.replace(/[^A-Za-zÀ-ÿ ]/g,"").split(" ").filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase();
const t=k=>(T[lang][k]??k);
const groupKey=g=>({Pitcher:"pitcher",Catcher:"catcher",Infielder:"infielder","Two-Way":"twoway"}[g]||"infielder");
const slugify=s=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const bgImg=u=>u?`background-image:url('${u}')`:"";
/* Escape untrusted text before it goes into innerHTML. Roster/modal data comes from
   Supabase (and originally from the public application form), so player-supplied
   strings like name/position/bio must not be able to inject markup. */
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function applyI18n(){
  document.documentElement.lang=lang;
  document.querySelectorAll("[data-i18n]").forEach(el=>el.textContent=t(el.dataset.i18n));
  document.querySelectorAll("[data-i18n-html]").forEach(el=>el.innerHTML=t(el.dataset.i18nHtml));
  document.querySelectorAll("#lang button").forEach(b=>b.classList.toggle("on",b.dataset.l===lang));
}
function setLang(l){lang=l;applyI18n();renderSportFilters();renderFilters();renderRoster();renderEvents();renderTesti();}

const SPORT_FILTERS=["All","Baseball","Softball"];
function renderSportFilters(){
  const f=document.getElementById("sportFilters");
  f.innerHTML=SPORT_FILTERS.map(x=>`<button type="button" class="chip ${x===activeSport?'active':''}" data-sf="${x}">${x==="All"?t("filter_all"):x}</button>`).join("");
  f.querySelectorAll(".chip").forEach(c=>c.onclick=()=>{activeSport=c.dataset.sf;active="All";renderFilters();renderSportFilters();renderRoster();});
}
const FILTERS=["All","Pitcher","Catcher","Infielder","Two-Way"];
function renderFilters(){
  const f=document.getElementById("filters");
  f.innerHTML=FILTERS.map(x=>`<button type="button" class="chip ${x===active?'active':''}" data-f="${x}">${t("filter_"+(x==="All"?"all":groupKey(x)))}</button>`).join("");
  f.querySelectorAll(".chip").forEach(c=>c.onclick=()=>{active=c.dataset.f;renderFilters();renderRoster();});
}
function renderRoster(){
  let list=activeSport==="All"?PLAYERS:PLAYERS.filter(p=>(p.sport||"Baseball")===activeSport);
  list=active==="All"?list:list.filter(p=>p.group===active);
  document.getElementById("rosterList").innerHTML=list.map(p=>{
    const hasPage=STATIC_PLAYER_PAGES.has(p.slug);
    const tag=hasPage?"a":"button";
    const linkAttr=hasPage?`href="players/${encodeURIComponent(p.slug)}.html"`:`data-slug="${esc(p.slug)}"`;
    return `
    <${tag} class="pcard" ${linkAttr}>
      <div class="top" style="${bgImg(p.image)}"><span class="flag">${esc(p.flag)||"🌎"}${p.heritage?(" "+esc(p.heritage)):""}</span>
        ${p.tier?`<span class="tier">${esc(p.tier)}</span>`:""}${p.image?"":`<span class="mono">${initials(p.name)}</span>`}</div>
      <div class="body"><h3 class="display">${esc(p.name)}</h3><div class="pos">${esc(p.position)}</div>
        ${p.teams&&p.teams[0]?`<div class="team">${esc(p.teams[0])}</div>`:""}<div class="view">${t("card_view")}</div></div>
    </${tag}>`;
  }).join("");
  document.querySelectorAll(".pcard[data-slug]").forEach(c=>c.onclick=()=>openModal(c.dataset.slug));
  // Headline stats are set by ESM, not derived from the roster: the public roster
  // only lists approved athletes, which undercounts who's actually represented.
}
function fmtDate(d){try{return new Date(d+"T00:00").toLocaleDateString(lang,{day:"numeric",month:"short",year:"numeric"})}catch(e){return d}}
let EV_VIEW=[];
function renderEvents(){
  const order={upcoming:0,past:1};
  EV_VIEW=[...EVENTS].sort((a,b)=>(order[a.status]-order[b.status])||a.date.localeCompare(b.date));
  document.getElementById("eventsList").innerHTML=EV_VIEW.map((e,i)=>`
    <div class="ev-card${e.media?' has-media':''}"${e.media?` data-ev="${i}" role="button" tabindex="0" aria-label="${esc(e.title)}"`:""}><div class="ev-img" style="${bgImg(e.image)}">
      <span class="ev-status ${e.status==='upcoming'?'up':'past'}">${e.status==='upcoming'?t("ev_upcoming"):t("ev_past")}</span>
      ${e.image?"":(e.icon||"⚾")}</div>
      <div class="ev-body"><h3 class="display">${esc(e.title)}</h3>
        <div class="ev-meta"><span>📅 ${fmtDate(e.date)}</span><span>📍 ${esc(e.loc)}</span></div>
        <p>${esc(e.blurb)}</p>
        ${e.tags?`<div class="ev-tags">${esc(e.tags)}</div>`:""}
        <div class="ev-actions">
          ${e.media?`<button type="button" class="ev-link ev-media-btn" data-ev="${i}">${t("ev_gallery")} \u2192</button>`:""}
          ${e.email?`<a class="ev-link" href="mailto:${e.email}">${t("ev_register")} \u2192</a>`:""}
        </div>
        </div></div>`).join("");
  const el=document.getElementById("eventsList");
  el.querySelectorAll(".ev-media-btn").forEach(b=>b.onclick=ev=>{ev.stopPropagation();openEventModal(+b.dataset.ev);});
  el.querySelectorAll(".ev-card.has-media").forEach(c=>{
    // Whole card opens the event detail (gallery lives inside it); the register
    // mailto and the explicit media button handle their own clicks.
    c.addEventListener("click",ev=>{if(ev.target.closest("a")||ev.target.closest(".ev-media-btn"))return;openEventModal(+c.dataset.ev);});
    c.addEventListener("keydown",ev=>{if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();openEventModal(+c.dataset.ev);}});
  });
}
/* Event detail modal \u2014 reuses the shared #modal sheet. The Tenerife Winter League
   media (video reel + photo gallery) is rendered here so it only appears once the
   athlete clicks into that event, rather than on the main page. */
function openEventModal(i){
  const e=EV_VIEW[i];if(!e)return;
  const media=e.media?`
      <div class="sub-label">${t("media_video_label")}</div>
      <div class="reel">${CLIPS.map(n=>`<video src="media/video/clip-${n}.mp4" poster="media/video/clip-${n}-poster.jpg" controls playsinline preload="none"></video>`).join("")}</div>
      <div class="sub-label">${t("media_photo_label")}</div>
      <div class="gal">${GALLERY.map(g=>`<button type="button" data-full="media/photos/${g.f}.jpg" data-cap="${g.c}"><img src="media/photos/${g.f}-thumb.jpg" alt="${g.c}" loading="lazy" decoding="async" /></button>`).join("")}</div>`:"";
  document.getElementById("sheetContent").innerHTML=`
    <div class="sh-top"><span class="sh-mono" style="${bgImg(e.image)}">${e.image?"":(e.icon||"\u26be")}</span>
      <div><h3 class="display">${esc(e.title)}</h3>
      <div class="sh-pos">\ud83d\udcc5 ${fmtDate(e.date)}</div>
      <div class="sh-meta">\ud83d\udccd ${esc(e.loc)}</div></div></div>
    <div class="sh-body">
      <p class="bio">${esc(e.blurb)}</p>
      ${e.tags?`<div class="ev-tags" style="margin:-10px 0 24px">${esc(e.tags)}</div>`:""}
      ${media}
      ${e.email?`<div style="margin-top:28px"><a class="btn btn-gold" href="mailto:${e.email}?subject=${encodeURIComponent(e.title+" \u2014 Registration")}">${t("ev_register")} \u2192</a></div>`:""}
    </div>`;
  document.querySelectorAll("#sheetContent .gal button").forEach(b=>b.onclick=()=>openLightbox(b.dataset.full,b.dataset.cap));
  document.getElementById("modal").classList.add("open");document.body.style.overflow="hidden";
}
/* Testimonial fields may be a plain string or an {en,es,it} object. */
const loc=v=>(v&&typeof v==="object")?(v[lang]||v.en||Object.values(v)[0]||""):(v||"");

function renderTesti(){
  document.getElementById("testiList").innerHTML=TESTIMONIALS.map(x=>`
    <div class="testi"><div class="q">“</div><p>${esc(loc(x.q))}</p>
      <div class="who">
        <div class="av" ${x.photo?`style="background-image:url('${x.photo}');background-size:cover;background-position:center 20%;border-color:var(--gold)"`:""}>${x.photo?"":initials(x.n)}</div>
        <div><div class="nm">${esc(x.n)}</div><div class="rl">${esc(loc(x.r))}</div></div>
      </div></div>`).join("");
  const feat=document.getElementById("featQuote");
  if(feat&&TESTIMONIALS[0])feat.textContent="\u201C"+loc(TESTIMONIALS[0].q)+"\u201D";
}

/* ===== media lightbox (opened from the event detail modal's photo gallery) ===== */
function openLightbox(src,cap){
  document.getElementById("sheetContent").innerHTML=
    `<div class="lightbox"><img src="${src}" alt="${cap}" /><p style="color:var(--muted);font-size:13.5px;margin-top:12px;text-align:center">${cap}</p></div>`;
  document.getElementById("modal").classList.add("open");document.body.style.overflow="hidden";
}
function openModal(slug){
  const p=PLAYERS.find(x=>x.slug===slug);if(!p)return;
  const meta=[p.born?("Born "+p.born):null,p.birthplace,p.bats?("Bats "+p.bats):null].filter(Boolean).join("  ·  ");
  document.getElementById("sheetContent").innerHTML=`
    <div class="sh-top"><span class="sh-mono" style="${bgImg(p.image)}">${p.image?"":initials(p.name)}</span>
      <div><h3 class="display">${esc(p.name)} <span style="font-size:.6em">${esc(p.flag)}${esc(p.heritage)}</span></h3>
      <div class="sh-pos">${esc(p.position)}</div><div class="sh-meta">${esc(meta)}</div></div></div>
    <div class="sh-body"><p class="bio">${esc(p.bio)}</p>
      ${p.stats&&p.stats.length?`<div class="sh-label">${t("modal_highlights")}</div><div class="sh-stats">${p.stats.map(s=>`<div class="sh-stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join("")}</div>`:""}
      ${p.teams&&p.teams.length?`<div class="sh-label">${t("modal_teams")}</div><div class="team-chips">${p.teams.map(x=>`<span class="team-chip">${esc(x)}</span>`).join("")}</div>`:""}
      <div class="sh-contact">
        <div class="sh-label">${t("modal_contact_h")}</div>
        <p class="sh-contact-p">${t("modal_contact_p")}</p>
        <a class="btn btn-gold" href="${STRIPE_CONTACT_URL||(FALLBACK_EMAIL+"?subject=Enquiry:%20"+encodeURIComponent(p.name)+"%20%E2%80%94%20ESM%20Roster")}" ${STRIPE_CONTACT_URL?'target="_blank" rel="noopener"':""}>${t("modal_contact_btn")}</a>
      </div>
    </div>`;
  document.getElementById("modal").classList.add("open");document.body.style.overflow="hidden";
}
/* ===== roster paywall =====
   Client-side gate: the valid code's SHA-256 lives in ROSTER_CODE_HASHES, and the
   unlock is remembered in localStorage so a buyer only enters it once. */
function isUnlocked(){try{return localStorage.getItem(UNLOCK_KEY)==="1"}catch(e){return false}}

async function sha256Hex(str){
  const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
function applyLockState(){
  const wrap=document.getElementById("rosterWrap");
  const note=document.getElementById("unlockedNote");
  const open=isUnlocked();
  if(wrap)wrap.classList.toggle("is-locked",!open);
  if(note)note.classList.toggle("show",open);
}
function unlockRoster(){
  try{localStorage.setItem(UNLOCK_KEY,"1")}catch(e){}
  applyLockState();
  renderRoster();
}
const gateForm=document.getElementById("gateForm");
if(gateForm)gateForm.addEventListener("submit",async e=>{
  e.preventDefault();
  const err=document.getElementById("gateErr");
  const val=(document.getElementById("gateInput").value||"").trim().toUpperCase();
  err.classList.remove("show");
  if(!val)return;
  let hash="";
  try{hash=await sha256Hex(val);}
  catch(ex){console.warn("crypto.subtle unavailable",ex);err.classList.add("show");return;}
  if(ROSTER_CODE_HASHES.includes(hash)){
    unlockRoster();
    document.getElementById("roster").scrollIntoView({behavior:"smooth",block:"start"});
  }else{
    err.classList.add("show");
  }
});

/* ===== profile-creation gate (€124.99) — independent second instance of the gate =====
   Own code hash (PROFILE_CODE_HASHES) and own localStorage key (PROFILE_UNLOCK_KEY), so
   it never collides with the roster gate. Unlocking reveals the CTA to the #join form. */
function isProfileUnlocked(){try{return localStorage.getItem(PROFILE_UNLOCK_KEY)==="1"}catch(e){return false}}
function applyProfileState(){
  const sec=document.getElementById("profile");
  if(sec)sec.classList.toggle("is-unlocked",isProfileUnlocked());
}
function unlockProfile(){
  try{localStorage.setItem(PROFILE_UNLOCK_KEY,"1")}catch(e){}
  applyProfileState();
}
const profileForm=document.getElementById("profileForm");
if(profileForm)profileForm.addEventListener("submit",async e=>{
  e.preventDefault();
  const err=document.getElementById("profileErr");
  const val=(document.getElementById("profileInput").value||"").trim().toUpperCase();
  err.classList.remove("show");
  if(!val)return;
  let hash="";
  try{hash=await sha256Hex(val);}
  catch(ex){console.warn("crypto.subtle unavailable",ex);err.classList.add("show");return;}
  if(PROFILE_CODE_HASHES.includes(hash)){
    unlockProfile();
    document.getElementById("join").scrollIntoView({behavior:"smooth",block:"start"});
  }else{
    err.classList.add("show");
  }
});

/* Service cards (College, Indy Ball, Winter League, Representation) drop the athlete
   into the Join form with their service already chosen, so the application says what
   they actually want. */
function wireServiceSignups(){
  document.querySelectorAll(".svc-signup").forEach(a=>{
    a.addEventListener("click",()=>{
      const svc=a.dataset.svc;
      const sel=document.getElementById("applyingSelect");
      if(sel&&svc&&[...sel.options].some(o=>o.value===svc)) sel.value=svc;
    });
  });
}

/* Point each pay button at its Stripe link; fall back to email until they exist. */
function wirePayButtons(){
  const set=(id,url)=>{const el=document.getElementById(id);if(el)el.href=url||FALLBACK_EMAIL;};
  set("rosterPayBtn",STRIPE_ROSTER_URL);
  set("profilePayBtn",PAYPAL_PROFILE_URL);
  set("joinPayBtn",STRIPE_REGISTER_URL);
  const col=document.getElementById("collegePayBtn");
  if(col)col.href=STRIPE_COLLEGE_URL||"#join";
}

function closeModal(){document.getElementById("modal").classList.remove("open");document.body.style.overflow="";}
document.querySelectorAll("[data-close]").forEach(e=>e.onclick=closeModal);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();});
document.getElementById("lang").querySelectorAll("button").forEach(b=>b.onclick=()=>setLang(b.dataset.l));
document.getElementById("yr").textContent=new Date().getFullYear();

// Sign In dropdown: close when clicking outside or pressing Escape.
(function(){
  const si=document.getElementById("signin");
  if(!si)return;
  document.addEventListener("click",e=>{if(si.open&&!si.contains(e.target))si.open=false;});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&si.open)si.open=false;});
})();

const form=document.getElementById("applyForm");
const FORM_T0=Date.now();   // page-load time, for the anti-spam time trap below
form.addEventListener("submit",async e=>{
  e.preventDefault();
  const fd=new FormData(form);
  const name=(fd.get("name")||"").trim();
  if(!name){form.querySelector("[name=name]").focus();return;}
  const role=fd.get("position")||"Infielder";   // Pitcher | Catcher | Infielder | Two-Way
  const sport=fd.get("sport")||"Baseball";
  const country=(fd.get("country")||"").trim();
  const btn=form.querySelector("button[type=submit]");
  const msg=document.getElementById("formMsg");
  msg.classList.remove("show","err");

  // Dependency-free spam guard: bots auto-fill the hidden honeypot ("company"), and no
  // real user reaches and submits this bottom-of-page form within 1.5s of load. Either
  // signal → show the success UI but skip the insert, so bots don't retry or spam the
  // moderation queue. Real submissions are unaffected.
  if((fd.get("company")||"").trim() || (Date.now()-FORM_T0)<1500){
    form.reset();msg.textContent=t("f_success");msg.classList.add("show");
    return;
  }

  // Applications require the live database; without it we can't save them.
  if(!SB){msg.textContent=t("f_error");msg.classList.add("show","err");msg.scrollIntoView({behavior:"smooth",block:"center"});return;}

  btn.disabled=true;
  // Saved as `pending` so an admin reviews it before it appears on the public roster.
  const {error}=await SB.from("players").insert({
    slug:slugify(name)+"-"+Date.now().toString(36),
    name,"group":role,position:role,sport,country,flag:FLAGS[country]||"🌎",tier:"New",
    bio:(fd.get("why")||"").trim()||"—",teams:[],stats:[],
    age:fd.get("age"),phone:fd.get("phone"),email:fd.get("email"),
    instagram:fd.get("ig"),applying_for:fd.get("applying"),message:fd.get("other"),
    // Tag paid €124.99 profile-gate submissions so admins can tell them apart from
    // regular representation applicants in the pending queue.
    source:isProfileUnlocked()?"profile-gate":"application",
    status:"pending",
  });
  btn.disabled=false;
  if(error){console.error("Application failed",error);msg.textContent=t("f_error");msg.classList.add("show","err");msg.scrollIntoView({behavior:"smooth",block:"center"});return;}
  form.reset();
  msg.textContent=t("f_success");msg.classList.add("show");
  // The lead is saved as `pending` first. Only now do we ask for the $125.
  const panel=document.getElementById("payPanel");
  panel.classList.add("show");
  panel.scrollIntoView({behavior:"smooth",block:"center"});
});

/* install prompt */
let deferredPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;document.getElementById("install").classList.add("show");});
document.getElementById("installBtn").onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;document.getElementById("install").classList.remove("show");}};
document.getElementById("installX").onclick=()=>document.getElementById("install").classList.remove("show");

async function boot(){
  if(SUPABASE_URL&&SUPABASE_ANON_KEY){
    try{const {createClient}=await import("https://esm.sh/@supabase/supabase-js@2");
      // The public site is anonymous by design. Don't load any signed-in session
      // from storage — otherwise a logged-in player/scout browsing the homepage
      // would send their JWT and RLS would return only their own row, breaking the
      // public roster. persistSession:false keeps every request purely anon.
      SB=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
      // Only approved players are publicly readable (enforced by RLS too). We request
      // just the public display columns — NOT the intake PII (age/phone/email/instagram/
      // message) — so an approved athlete's contact details are never sent to the browser.
      const {data,error}=await SB.from("players")
        .select("slug,name,group,position,country,flag,heritage,born,birthplace,tier,bats,bio,teams,stats,image_url,sport,sort_order")
        .eq("status","approved").order("sort_order");
      if(error)throw error;
      // Supabase stores the photo in `image_url`; the renderer reads `image`.
      if(data&&data.length)PLAYERS=data.map(p=>({...p,image:p.image_url||p.image||null}));
    }catch(err){console.warn("Supabase load failed; using embedded roster.",err);}
  }
  // Repo-committed photos fill in only where Supabase has none.
  PLAYERS=PLAYERS.map(p=>({...p,image:p.image||LOCAL_PHOTOS[p.slug]||null}));
  wireServiceSignups();
  applyI18n();renderSportFilters();renderFilters();renderRoster();renderEvents();renderTesti();
}
// Apply the roster lock state synchronously, before boot()'s async network work.
// The lock depends only on localStorage; gating it behind the esm.sh import + Supabase
// fetch made already-unlocked visitors see the "$49.99" gate flash on slow connections
// (the roster ships with `is-locked` in the HTML and JS only removes it once unlocked).
applyLockState();
applyProfileState();
// Wire the pay buttons synchronously too: their hrefs come only from top-level
// constants (no network), so doing this before boot()'s async import+fetch means the
// "$49.99" roster button always has a working target even if the connection stalls —
// previously it stayed href="#" until boot() finished (a tap-does-nothing race on slow iOS).
wirePayButtons();
boot();
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));}
