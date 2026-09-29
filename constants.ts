
import { Category, User } from './types';

export const MASTER_ADMIN_EMAIL = 'medleaobh@gmail.com';
export const ADMIN_EMAILS = ['medleaobh@gmail.com', 'rafaelleaobh@gmail.com'];
export const ADMIN_EMAIL = 'medleaobh@gmail.com';

export const DEMO_USER: User = {
  email: 'visitante@neurogestor.demo',
  name: 'Visitante (Modo Demonstração)',
  status: 'APPROVED',
  role: 'user',
  onboarding_completed: true,
  financial_config: { pricing_model: 'fixed', default_fee: 1000 },
  team_id: 'demonstracao',
  team_name: 'Equipe Demonstração',
  is_demo: true,
};

export const isDemoUser = (userOrEmail?: User | string | null): boolean => {
  if (!userOrEmail) return false;
  if (typeof userOrEmail === 'string') {
    return userOrEmail.toLowerCase().trim() === DEMO_USER.email.toLowerCase();
  }
  return !!userOrEmail.is_demo || userOrEmail.email.toLowerCase().trim() === DEMO_USER.email.toLowerCase();
};

export const isMasterAdmin = (email?: string | null): boolean => {
  if (!email) return false;
  return email.toLowerCase().trim() === MASTER_ADMIN_EMAIL.toLowerCase();
};

export const isAdminUser = (email?: string | null): boolean => {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  return ADMIN_EMAILS.some(admin => admin.toLowerCase() === e);
};

export const AVAILABLE_TEAMS = [
  { id: 'camarinha', name: 'Equipe Camarinha' }
];

export const SEED_DOCTORS = [
  'ALEXANDRE DE RESENDE',
  'ALUIZIO ARANTES',
  'ALUIZIO AUGUSTO',
  'ALVARO DE ASSIS',
  'ANDRE CASTILHO',
  'ANDRE DE ALMEIDA',
  'ANDRE DE SA',
  'BALTAZAR LEAO',
  'BARBARA MARTINS',
  'CARLOS EDUARDO',
  'CLERISTON LACERDA',
  'CLEVERSON KILL',
  'CRISTIANO LIMA',
  'CRISTIANO MENESES',
  'DANIEL BELO NUNES',
  'DANIEL CUNHA',
  'DAVID CARVALHO',
  'DIOGO VASCONCELOS',
  'DUILIO WALTER',
  'EDUARDO ROSSI',
  'FABIO DA CUNHA PEIXOTO',
  'FABIO SANTANA',
  'FELIPE MALUF',
  'FERNANDO ARBEX',
  'FERNANDO GADBEM',
  'FERNANDO GOSENDE',
  'FERNANDO JACOBSEN',
  'FLAVIO PINELLI',
  'FLAVIO SIRIHAL WERKEMA',
  'GABRIEL MATOS',
  'GILBERTO DE ALMEIDA',
  'GUILHERME GONTIJO',
  'GUILHERME MAGALHAES',
  'GUILHERME MANSUR',
  'GUILHERME ZANINI',
  'GUSTAVO CARDOSO',
  'HUGO ABI-SABER',
  'JADER DE ANDRADE',
  'JOAO BATISTA DE OLIVEIRA',
  'JOAO THIAGO',
  'JONAS',
  'JOSE AUGUSTO MALHEIROS',
  'JULIANO CLAUDIO',
  'JULIO CESAR CUNHA',
  'JULIO CESAR DE ALMEIDA',
  'JULIO CESAR MARTINS',
  'JULIO CESAR SANTIAGO',
  'LEANDRO CUSTODIO',
  'LEANDRO NAPIER',
  'LEONARDO AUGUSTO',
  'LUCAS RODRIGUES DE SOUZA',
  'LUCIDIO DUARTE',
  'LUIZ CLAUDIO DE MOURA',
  'LYSIO FRANCA',
  'MARCELO MAGALDI',
  'MARCELO PENHOLATE',
  'MARCELO RUGANI',
  'MARCELO VIANA',
  'MARCONI TEIXEIRA',
  'MARCOS ANTONIO',
  'MARCOS DELARETTI',
  'MARIANA DENARO',
  'MIRIAM CABRAL',
  'ORLANDIL',
  'PAULO ALABART',
  'PAULO MALLARD',
  'PLINIO DUARTE',
  'RAFAEL BRANDAO',
  'RAFAEL LOUREIRO',
  'RAFAEL SUCUPIRA',
  'RAPHAEL COUTINHO',
  'RICARDO DELFINO',
  'RICARDO FELIPE',
  'ROBERTO LEAL',
  'RODRIGO PERRONI',
  'RONALDO PACHECO',
  'SANDRO PEDROSO LEMOS',
  'SAVIO LOUREIRO',
  'SERGIO MONTEIRO',
  'TACITO TSCHERBAKOWSKI',
  'VINICIOS RIVELLI',
  'VITOR VIEIRA',
  'WILSON FAGLIONI'
];

export const SEED_HOSPITALS = [
  'BIOCOR',
  'FELICIO ROCHO',
  'HOSPITAL BELO HORIZONTE',
  'HOSPITAL DA BALEIA',
  'HOSPITAL DA POLICIA MILITAR (HPM)',
  'HOSPITAL LUXEMBURGO',
  'HOSPITAL MADRE TERESA',
  'HOSPITAL SANTA RITA',
  'HOSPITAL SAO LUCAS',
  'HOSPITAL SOCOR',
  'HOSPITAL VILA DA SERRA',
  'INSTITUTO DE OTORRINO',
  'MATERDEI BETIM',
  'MATERDEI CONTORNO',
  'MATERDEI NOVA LIMA',
  'MATERDEI SANTO AGOSTINHO',
  'MATERDEI VILA DA SERRA',
  'ORIZONTI',
  'SANTA CASA BH',
  'SAO CAMILO',
  'SAO FRANCISCO',
  'SEMPER',
  'UNIMED BETIM',
  'UNIMED CONTORNO',
  'UNIMED SETE LAGOAS'
];

// Lista de procedimentos conhecidos (usada para OCR inteligente)
export const SEED_PROCEDURES = [
  'ARTRODESE', 'CORPECTOMIA', 'LAMINECTOMIA', 'ENDOSCOPICA', 'ENDOSCOPIA',
  'ALIFF', 'OLIFF', 'TLIFF', 'XLIFF', 'XALIFF',
  'ESCOLIOSE', 'CIFOSE', 'DBS', 'NEUROESTIMULADOR',
  'FACIAL DIREITO', 'FACIAL ESQUERDO', 'FACIAL BILATERAL', 'FACIAL',
  'PLEXO BRAQUIAL', 'NEUROLISE', 'NEUROLISE TIBIAL', 'NEUROLISE FACIAL',
  'TUMOR CRANIANO', 'TUMOR CEREBRAL', 'TUMOR CEREBELAR', 'TUMOR FRONTAL',
  'TUMOR OSSEO', 'TUMOR TORACICO', 'TUMOR INTRADURAL',
  'TUMOR PLEXO BRAQUIAL', 'TUMOR PLEXO LOMBOSSACRO', 'TUMOR SARTORIO',
  'TUMOR NERVO CIATICO', 'TUMOR SELA TURCICA',
  'ANEURISMA', 'ANEURISMA OFTALMICA', 'CAVERNOMA',
  'MENINGEOMA', 'MENINGIOMA', 'MENINGEOMA FOSSA POSTERIOR', 'MENINGEOMA CLINOIDE',
  'NEURINOMA', 'GLOMUS JUGULAR', 'GBM', 'RECIDIVA GBM',
  'TIREOIDECTOMIA', 'PAROTIDECTOMIA', 'MASTOIDECTOMIA',
  'ESPASMO HEMIFACIAL', 'DESCOMPRESSAO TRIGEMEO', 'TRIGÊMEO',
  'ARTROPLASTIA', 'ODONTOIDECTOMIA', 'ENDARTERECTOMIA',
  'BYPASS CEREBRAL', 'CHIARI', 'HIPOFISE', 'SIRINGOMIELOMA',
  'HERNIA', 'TRM', 'FRATURA ODONTOIDE', 'CORDOMA CERVICAL',
  'DESCOMPRESSÃO', 'FIXACÃO', 'REPOSICIONAMENTO'
];

// Mapeamento canônico oficial de médicos (sempre sem 'DR.')
export const DOCTOR_ALIASES: Record<string, string> = {
  // Wilson Faglioni
  'WILSON FAGLIONI': 'WILSON FAGLIONI',
  'WILSON FAGLIONI JUNIOR': 'WILSON FAGLIONI',
  'DR. WILSON': 'WILSON FAGLIONI',
  'DR WILSON': 'WILSON FAGLIONI',
  'DR WILSON FAGLIONI': 'WILSON FAGLIONI',
  'DR. WILSON FAGLIONI': 'WILSON FAGLIONI',
  'DR WILSON FAGLIONI JUNIOR': 'WILSON FAGLIONI',

  // Sávio Loureiro
  'SAVIO': 'SAVIO LOUREIRO',
  'DR SAVIO': 'SAVIO LOUREIRO',
  'DR. SAVIO': 'SAVIO LOUREIRO',
  'SAVIO LOUREIRO': 'SAVIO LOUREIRO',
  'DR SAVIO LOUREIRO': 'SAVIO LOUREIRO',
  'DR. SAVIO LOUREIRO': 'SAVIO LOUREIRO',
  'DR. SAVIO LOUREIRO LABORNE': 'SAVIO LOUREIRO',
  'SAVIO LOUREIRO LABORNE DE MENDONCA': 'SAVIO LOUREIRO',

  // Clériston Lacerda
  'CLERISTON': 'CLERISTON LACERDA',
  'DR. CLERISTON': 'CLERISTON LACERDA',
  'DR CLERISTON': 'CLERISTON LACERDA',
  'DR CLERISTON LACERDA': 'CLERISTON LACERDA',
  'DR. CLERISTON LACERDA': 'CLERISTON LACERDA',
  'CLERISTON LACERDA': 'CLERISTON LACERDA',
  'DR. CLERISTON LOPES': 'CLERISTON LACERDA',
  'CLERISTON LOPES LACERDA': 'CLERISTON LACERDA',

  // Guilherme Gontijo
  'GUILHERME GONTIJO': 'GUILHERME GONTIJO',
  'DR GUILHERME GONTIJO': 'GUILHERME GONTIJO',
  'DR. GUILHERME GONTIJO': 'GUILHERME GONTIJO',
  'GUILHERME GONTIJO SOARES': 'GUILHERME GONTIJO',
  'DR GUILHERME GONTIJO SOARES': 'GUILHERME GONTIJO',

  // Rafael Brandão
  'RAFAEL BRANDAO': 'RAFAEL BRANDAO',
  'DR RAFAEL BRANDAO': 'RAFAEL BRANDAO',
  'DR. RAFAEL BRANDAO': 'RAFAEL BRANDAO',
  'DR RAFAEL AUGUSTO BRANDAO': 'RAFAEL BRANDAO',
  'RAFAEL AUGUSTO CASTRO SANTI': 'RAFAEL BRANDAO',
  'RAFAEL AUGUSTO CASTRO SANTIAGO BRANDAO': 'RAFAEL BRANDAO',

  // Flávio Pinelli
  'FLAVIO PINELLI': 'FLAVIO PINELLI',
  'DR FLAVIO PINELLI': 'FLAVIO PINELLI',
  'DR. FLAVIO PINELLI': 'FLAVIO PINELLI',
  'FLAVIO VALE PINELLI NOGUEIRA': 'FLAVIO PINELLI',

  // Marcelo Viana
  'MARCELO VIANA': 'MARCELO VIANA',
  'DR MARCELO VIANA': 'MARCELO VIANA',
  'DR. MARCELO VIANA': 'MARCELO VIANA',
  'DR MARCELO VIANA RODRIGUES': 'MARCELO VIANA',
  'MARCELO VIANA RODRIGUES DA CUNHA': 'MARCELO VIANA',

  // Ricardo Delfino
  'RICARDO DELFINO': 'RICARDO DELFINO',
  'DR RICARDO DELFINO': 'RICARDO DELFINO',
  'DR. RICARDO DELFINO': 'RICARDO DELFINO',
  'RICARDO AUGUSTO DELFINO': 'RICARDO DELFINO',

  // Miriam Cabral
  'MIRIAM CABRAL': 'MIRIAM CABRAL',
  'DRA MIRIAM CABRAL': 'MIRIAM CABRAL',
  'DRA. MIRIAM CABRAL': 'MIRIAM CABRAL',
  'DRA MIRIAM': 'MIRIAM CABRAL',
  'DRA. MIRIAM': 'MIRIAM CABRAL',
  'DRA. MIRIAM CABRAL MOREIRA': 'MIRIAM CABRAL',
  'DRA MIRIAM CABRAL MOREIRA CASTRO': 'MIRIAM CABRAL',
  'MIRIAN CABRAL MOREIRA DE CASTRO': 'MIRIAM CABRAL',

  // Guilherme Zanini
  'GUILHERME ZANINI': 'GUILHERME ZANINI',
  'DR GUILHERME ZANINI': 'GUILHERME ZANINI',
  'GUILHERME ZANINI ROCHA': 'GUILHERME ZANINI',

  // Eduardo Rossi
  'EDUARDO ROSSI': 'EDUARDO ROSSI',
  'DR EDUARDO ROSSI': 'EDUARDO ROSSI',
  'EDUARDO MACHADO ROSSI MONTEIRO': 'EDUARDO ROSSI',

  // Álvaro de Assis (unificado com Álvaro Sobrinho)
  'ALVARO ASSIS': 'ALVARO DE ASSIS',
  'DR ALVARO ASSIS': 'ALVARO DE ASSIS',
  'ALVARO DE ASSIS': 'ALVARO DE ASSIS',
  'DR ALVARO DE ASSIS': 'ALVARO DE ASSIS',
  'ALVARO SOBRINHO': 'ALVARO DE ASSIS',
  'DR ALVARO SOBRINHO': 'ALVARO DE ASSIS',

  // Fernando Jacobsen
  'FERNANDO JACOBSEN': 'FERNANDO JACOBSEN',
  'DR FERNANDO JACOBSEN': 'FERNANDO JACOBSEN',
  'FERNANDO JACOBSEN BARROS': 'FERNANDO JACOBSEN',

  // Fábio Santana
  'FABIO SANTANA': 'FABIO SANTANA',
  'DR FABIO SANTANA': 'FABIO SANTANA',
  'FABIO SANTANA CARVALHO': 'FABIO SANTANA',

  // Daniel Cunha
  'DANIEL CUNHA': 'DANIEL CUNHA',
  'DR DANIEL CUNHA': 'DANIEL CUNHA',
  'DR DANIEL CUNHA DE ARAUJO': 'DANIEL CUNHA',

  // Marcelo Penholate
  'MARCELO PENHOLATE': 'MARCELO PENHOLATE',
  'MARCELLO PENHOLATE FARIA': 'MARCELO PENHOLATE',

  // Júlio César Cunha (separado de Martins, Almeida e Santiago)
  'JULIO CESAR': 'JULIO CESAR CUNHA',
  'DR JULIO CESAR': 'JULIO CESAR CUNHA',
  'JULIO CUNHA': 'JULIO CESAR CUNHA',
  'DR JULIO CUNHA': 'JULIO CESAR CUNHA',
  'JULIO CESAR CUNHA': 'JULIO CESAR CUNHA',
  'DR JULIO CESAR CUNHA': 'JULIO CESAR CUNHA',

  // Júlio César Martins
  'JULIO MARTINS': 'JULIO CESAR MARTINS',
  'DR JULIO CESAR MARTINS': 'JULIO CESAR MARTINS',
  'JULIO CESAR CORREA MARTINS': 'JULIO CESAR MARTINS',

  // Júlio César de Almeida
  'DR JULIO CESAR DE ALMEIDA': 'JULIO CESAR DE ALMEIDA',
  'JULIO CESAR DE ALMEIDA': 'JULIO CESAR DE ALMEIDA',

  // Júlio César Santiago
  'DR. JULIO CESAR SANTIAGO': 'JULIO CESAR SANTIAGO',
  'JULIO CESAR SANTIAGO': 'JULIO CESAR SANTIAGO',

  // Lucídio Duarte
  'LUCIDIO': 'LUCIDIO DUARTE',
  'DR LUCIDIO': 'LUCIDIO DUARTE',
  'LUCIDIO DUARTE': 'LUCIDIO DUARTE',
  'DR LUCIDIO DUARTE': 'LUCIDIO DUARTE',
  'LUCIDIO DUARTE DE SOUZA FILHO': 'LUCIDIO DUARTE',

  // Rafael Sucupira
  'RAFAEL SUCUPIRA': 'RAFAEL SUCUPIRA',
  'DR RAFAEL SUCUPIRA': 'RAFAEL SUCUPIRA',
  'RAFAEL MOURA E SUCUPIRA': 'RAFAEL SUCUPIRA',

  // Roberto Leal
  'ROBERTO LEAL': 'ROBERTO LEAL',
  'DR ROBERTO LEAL': 'ROBERTO LEAL',
  'ROBERTO LEAL DA SILVEIRA': 'ROBERTO LEAL',

  // Cristiano Meneses (separado de Cristiano Lima)
  'CRISTIANO MENESES': 'CRISTIANO MENESES',
  'DR CRISTIANO MENESES': 'CRISTIANO MENESES',
  'CRISTIANO MAGALHAES MENEZES': 'CRISTIANO MENESES',

  // Cristiano Lima
  'CRISTIANO LIMA': 'CRISTIANO LIMA',
  'DR CRISTIANO LIMA': 'CRISTIANO LIMA',

  // Rodrigo Perroni
  'RODRIGO PERRONI': 'RODRIGO PERRONI',
  'DR RODRIGO PERRONI': 'RODRIGO PERRONI',
  'RODRIGO PERRONI CRUZEIRO': 'RODRIGO PERRONI',

  // Leandro Custódio (unificado com Leandro Amaral)
  'LEANDRO CUSTODIO': 'LEANDRO CUSTODIO',
  'DR. LEANDRO CUSTORIO': 'LEANDRO CUSTODIO',
  'LEANDRO CUSTODIO DO AMARAL': 'LEANDRO CUSTODIO',
  'DR LEANDRO AMARAL': 'LEANDRO CUSTODIO',
  'LEANDRO AMARAL': 'LEANDRO CUSTODIO',

  // Sérgio Monteiro
  'SERGIO MONTEIRO': 'SERGIO MONTEIRO',
  'DR SERGIO MONTEIRO': 'SERGIO MONTEIRO',
  'SERGIO MONTEIRO LIMA JUNIOR': 'SERGIO MONTEIRO',

  // Ronaldo Pacheco
  'RONALDO PACHECO': 'RONALDO PACHECO',
  'DR RONALDO PACHECO': 'RONALDO PACHECO',
  'DR. RONALDO GAMA PACHECO': 'RONALDO PACHECO',

  // Marcos Antônio
  'MARCOS ANTONIO': 'MARCOS ANTONIO',
  'DR MARCOS ANTONIO': 'MARCOS ANTONIO',
  'MARCOS ANTONIO FERREIRA JUNIOR': 'MARCOS ANTONIO',

  // Jader de Andrade
  'JADER': 'JADER DE ANDRADE',
  'DR JADER': 'JADER DE ANDRADE',
  'JADER DE ANDRADE NETO': 'JADER DE ANDRADE',

  // Plínio Duarte
  'PLINIO': 'PLINIO DUARTE',
  'DR PLINIO': 'PLINIO DUARTE',
  'PLINIO DUARTE MENDES': 'PLINIO DUARTE',

  // João Batista de Oliveira
  'JOAO BATISTA': 'JOAO BATISTA DE OLIVEIRA',
  'DR JOAO BATISTA': 'JOAO BATISTA DE OLIVEIRA',
  'DR JOAO BATISTA DE OLIVEIRA': 'JOAO BATISTA DE OLIVEIRA',
  'JOAO BATISTA DE OLIVEIRA ANDRADE': 'JOAO BATISTA DE OLIVEIRA',

  // Mariana Denaro
  'MARIANA MOREIRA': 'MARIANA DENARO',
  'DRA MARIANA MOREIRA': 'MARIANA DENARO',
  'MARIANA DE CASTRO': 'MARIANA DENARO',
  'DRA MARIANA DE CASTRO': 'MARIANA DENARO',
  'MARIANA MOREIRA DE CASTRO DENARO': 'MARIANA DENARO',

  // Cleverson Kill
  'CLEVERSON KILL': 'CLEVERSON KILL',
  'DR CLEVERSON KILL': 'CLEVERSON KILL',
  'DR. CLEVERSON KILL': 'CLEVERSON KILL',
  'DR. CLAVERSON KILL': 'CLEVERSON KILL',
  'DR CLEVERSON MARTINS KILL': 'CLEVERSON KILL',

  // Paulo Mallard
  'PAULO MALARD': 'PAULO MALLARD',
  'DR PAULO MALARD': 'PAULO MALLARD',
  'DR PAULO MALLARD': 'PAULO MALLARD',
  'PAULO MALLARD SCALDAFERRI': 'PAULO MALLARD',

  // Guilherme Mansur
  'GUILHERME MANSUR': 'GUILHERME MANSUR',
  'DR GUILHERME MANSUR': 'GUILHERME MANSUR',
  'GUILHERME RIBEIRO MANSUR BARBOSA': 'GUILHERME MANSUR',

  // Guilherme Magalhães
  'GUILHERME MAGALHAES': 'GUILHERME MAGALHAES',
  'DR GUILHERME MAGALHAES': 'GUILHERME MAGALHAES',
  'DR GUILHERME DE MAGALHAES': 'GUILHERME MAGALHAES',
  'DR GUILHERME DE MAGALHAES VIEIRA MACHADO': 'GUILHERME MAGALHAES',

  // Fernando Arbex
  'FERNANDO ARBEX': 'FERNANDO ARBEX',
  'DR FERNANDO ARBEX': 'FERNANDO ARBEX',
  'FERNANDO ARBEX SABINO': 'FERNANDO ARBEX',

  // Fernando Gadbem
  'FERNANDO MIGUEL': 'FERNANDO GADBEM',
  'DR FERNANDO MIGUEL': 'FERNANDO GADBEM',
  'DR FERNANDO MIGUEL GADBEM': 'FERNANDO GADBEM',
  'FERNANDO MIGUEL RESCK GADE': 'FERNANDO GADBEM',
  'FERNANDO GADBEM': 'FERNANDO GADBEM',

  // Diogo Vasconcelos
  'DIOGO VASCONCELOS': 'DIOGO VASCONCELOS',
  'DR DIOGO VASCONCELOS': 'DIOGO VASCONCELOS',
  'DR. DIOGO GUILHERME DE VASCONCELOS': 'DIOGO VASCONCELOS',
  'DR. DIOGO VASCONCELLUS': 'DIOGO VASCONCELOS',

  // Vinícios Rivelli
  'VINICIOS RIVELLI': 'VINICIOS RIVELLI',
  'DR VINICIOS RIVELLI': 'VINICIOS RIVELLI',
  'DR. VINICIOS': 'VINICIOS RIVELLI',
  'VINICIOS RIVELLI DA FONSECA': 'VINICIOS RIVELLI',

  // Tácito Tscherbakowski
  'TACITO TSCHER': 'TACITO TSCHERBAKOWSKI',
  'DR. TACITO TSCHER': 'TACITO TSCHERBAKOWSKI',
  'DR. TACITO TSCHERBAKOWSKI': 'TACITO TSCHERBAKOWSKI',

  // Raphael Coutinho
  'RAPHAEL COUTINHO': 'RAPHAEL COUTINHO',
  'DR. RAPHAEL COUTINHO': 'RAPHAEL COUTINHO',
  'RAPHAEL PEREIRA COUTINHO': 'RAPHAEL COUTINHO',

  // Felipe Maluf
  'DR. FELIPE MALUF': 'FELIPE MALUF',
  'DR. FELIPE BICALHO MALUF': 'FELIPE MALUF',
  'FELIPE MALUF': 'FELIPE MALUF',

  // Fernando Gosende
  'FERNANDO GOSENDE': 'FERNANDO GOSENDE',
  'FERNANDO MAGALHAES GOSEND': 'FERNANDO GOSENDE',

  // Baltazar Leão
  'BALTAZAR LEAO': 'BALTAZAR LEAO',
  'DR BALTAZAR LEAO': 'BALTAZAR LEAO',

  // Hugo Abi-Saber
  'HUGO ABI-SABER': 'HUGO ABI-SABER',
  'DR HUGO ABI-SABER': 'HUGO ABI-SABER',

  // Marcos Delaretti
  'MARCOS DELARETTI': 'MARCOS DELARETTI',
  'DR MARCOS DELARETTI': 'MARCOS DELARETTI',

  // André de Almeida
  'ANDRE DE ALMEIDA': 'ANDRE DE ALMEIDA',
  'DR ANDRE DE ALMEIDA': 'ANDRE DE ALMEIDA'
};

// Abreviações e variações comuns de hospitais para mapeamento canônico
export const HOSPITAL_ALIASES: Record<string, string> = {
  // Hospital da Polícia Militar
  'HPM': 'HOSPITAL DA POLICIA MILITAR (HPM)',
  'HOSPITAL DA POLICIA MILITAR': 'HOSPITAL DA POLICIA MILITAR (HPM)',
  'HOSPITAL POLICIA': 'HOSPITAL DA POLICIA MILITAR (HPM)',
  'POLICIA MILITAR': 'HOSPITAL DA POLICIA MILITAR (HPM)',

  // Unimed Contorno (Unimed BH unificado)
  'UNIMED': 'UNIMED CONTORNO',
  'UNIMED BH': 'UNIMED CONTORNO',
  'UNIMED CONTORNO': 'UNIMED CONTORNO',

  // MaterDei Contorno
  'MATERDEI': 'MATERDEI CONTORNO',
  'MATER DEI': 'MATERDEI CONTORNO',
  'MATER DEI CONTORNO': 'MATERDEI CONTORNO',
  'HOSPITAL MATER DEI CONTORNO': 'MATERDEI CONTORNO',
  'MATERDEI CONTORNO': 'MATERDEI CONTORNO',

  // MaterDei Santo Agostinho
  'MATER STO AGOSTINHO': 'MATERDEI SANTO AGOSTINHO',
  'MATER DEI STO AGOSTINHO': 'MATERDEI SANTO AGOSTINHO',
  'MATERDEI STO AGOSTINHO': 'MATERDEI SANTO AGOSTINHO',
  'MATER DEI SANTO AGOSTINHO': 'MATERDEI SANTO AGOSTINHO',
  'HOSPITAL MATER DEI STO AGOSTINHO': 'MATERDEI SANTO AGOSTINHO',
  'MATERDEI SANTO AGOSTINHO': 'MATERDEI SANTO AGOSTINHO',

  // MaterDei Betim
  'MATER DEI BETIM': 'MATERDEI BETIM',
  'HOSPITAL MATER DEI BETIM': 'MATERDEI BETIM',
  'MATERDEI BETIM': 'MATERDEI BETIM',

  // MaterDei Nova Lima
  'MATERDEI NOVA LIMA': 'MATERDEI NOVA LIMA',

  // MaterDei Vila da Serra (separado de Hospital Vila da Serra)
  'MATERDEI VILA DA SERRA': 'MATERDEI VILA DA SERRA',

  // Hospital Vila da Serra
  'VILA DA SERRA': 'HOSPITAL VILA DA SERRA',
  'HVS': 'HOSPITAL VILA DA SERRA',
  'HOSPITAL VILA DA SERRA': 'HOSPITAL VILA DA SERRA',

  // Madre Teresa
  'HMT': 'HOSPITAL MADRE TERESA',
  'MT': 'HOSPITAL MADRE TERESA',
  'MADRE TEREZA': 'HOSPITAL MADRE TERESA',
  'MADRE TERESA': 'HOSPITAL MADRE TERESA',
  'HOSPITAL MADRE TERESA': 'HOSPITAL MADRE TERESA',

  // Felício Rocho
  'FELICIO': 'FELICIO ROCHO',
  'FELÍCIO': 'FELICIO ROCHO',
  'FELICIO ROCHO': 'FELICIO ROCHO',
  'FELÍCIO ROCHO': 'FELICIO ROCHO',
  'HOSPITAL FELICIO ROCHO': 'FELICIO ROCHO',

  // São Lucas
  'SAO LUCAS': 'HOSPITAL SAO LUCAS',
  'SÃO LUCAS': 'HOSPITAL SAO LUCAS',
  'S. LUCAS': 'HOSPITAL SAO LUCAS',
  'HOSPITAL SAO LUCAS': 'HOSPITAL SAO LUCAS',

  // Santa Rita
  'SANTA RITA': 'HOSPITAL SANTA RITA',
  'HOSPITAL SANTA RITA': 'HOSPITAL SANTA RITA',

  // Luxemburgo
  'LUXEMBURGO': 'HOSPITAL LUXEMBURGO',
  'LUXEMBURO': 'HOSPITAL LUXEMBURGO',
  'HOSPITAL LUXEMBURGO': 'HOSPITAL LUXEMBURGO',
  'HOSPITAL LUXEMBURO': 'HOSPITAL LUXEMBURGO',

  // Santa Casa BH
  'SANTA CASA': 'SANTA CASA BH',
  'SANTA CASA BH': 'SANTA CASA BH',

  // Socor
  'SOCOR': 'HOSPITAL SOCOR',
  'SOCCOR': 'HOSPITAL SOCOR',
  'HOSPITAL SOCOR': 'HOSPITAL SOCOR',

  // Orizonti
  'HORIZ': 'ORIZONTI',
  'ORIZONTI': 'ORIZONTI',
  'INSTITUTO ORIZONTI': 'ORIZONTI',

  // Instituto de Otorrino
  'INSTITUTO DE OTORRINO': 'INSTITUTO DE OTORRINO',

  // São Camilo
  'SÃO CAMILO': 'SAO CAMILO',
  'S. CAMILO': 'SAO CAMILO',
  'SAO CAMILO': 'SAO CAMILO',

  // Semper
  'SEMPER': 'SEMPER'
};

export const COMPLEX_KEYWORDS = [
  'trigemeo', 'espasmo', 'microvascular', 'cranio', 'artrodese', 'corpectomia',
  'hernia', 'cervical', 'lombar', 'toracic', 'cifoplastia', 'dbs', 'aneurisma',
  'cavernoma', 'meningioma', 'glomus', 'cranial', 'craniana', 'coluna'
];

export const PERIPHERAL_KEYWORDS = [
  'facial', 'plexo', 'nervo', 'neurolise', 'tunel', 'carpiano', 'biopsia', 'timpanoplastia'
];

export const TUMOR_KEYWORDS = [
  'tumor', 'nervo', 'plexo', 'ciatico', 'bainha', 'periferico'
];

export const PRICING = {
  HIGH_COMPLEXITY: 1100,
  PERIPHERAL: 800,
  TUMOR_NERVE: 800,
  DEFAULT: 1100
};

// ============================================================
// NEUROGESTOR 2.0 — Taxonomia clínica e Portfólio
// ============================================================

export const SUBTYPES: Record<string, string[]> = {
  [Category.COLUNA]: [
    'Artrodese Cervical',
    'Artrodese Lombar (TLIF/XLIF/OLIF/ALIF)',
    'Artrodese Torácica',
    'Artrodese Toracolombar',
    'Escoliose / Cifose',
    'Cirurgia Endoscópica',
    'Tumor de Coluna - Intradural',
    'Tumor de Coluna - Extradural',
    'Corpectomia / Laminectomia',
    'Trauma Vertebral / Fratura',
    'Neuroestimulador',
    'Outro',
  ],
  [Category.CRANIO]: [
    'Tumor Base de Crânio',
    'Hipófise / Sellar',
    'Meningeoma',
    'GBM / Glioma Alto Grau',
    'Mapeamento Cortical (Awake)',
    'Mapeamento Subcortical',
    'Aneurisma / Cavernoma',
    'Neurinoma Acústico',
    'Glomus Jugular',
    'Espasmo Hemifacial / Trigêmeo',
    'DBS / Neuroestimulador',
    'Outro',
  ],
  [Category.NERVO_PERIFERICO]: [
    'Facial — Parotidectomia',
    'Facial — Otorrino',
    'Facial — Bucomaxilo',
    'Laríngeo Recorrente',
    'Plexo Braquial',
    'Plexo Lombossacro',
    'Tumor de Nervo Periférico',
    'Descompressão Microvascular',
    'Outro',
  ],
};

export const COMPLEXITY_CONFIG = {
  routine:     { label: 'Rotina',      emoji: '🟢', color: 'emerald' },
  challenging: { label: 'Desafiador',  emoji: '🟡', color: 'amber'   },
  complex:     { label: 'Complexo',    emoji: '🔴', color: 'red'     },
  landmark:    { label: 'Landmark',    emoji: '⭐', color: 'purple'  },
} as const;

export const PORTFOLIO_TAG_SUGGESTIONS = [
  'Neuroestimulador',
  'Déficit pré-operatório',
  'Déficit pós-operatório (ao acordar)',
  'Primeiro caso',
  'Awake surgery',
  'Tumor gigante',
  'Recuperação total',
  'Caso raro',
  'Caso educativo',
  'Achado intraoperatório',
  'Alarme intraoperatório',
  'Perda neurofisiológica',
  'Caso com complicação',
  'Revisão cirúrgica',
];

export const TECNICAS_MNIO = [
  'PEM (Potencial Evocado Motor)',
  'PESS (Potencial Evocado Somatossensitivo)',
  'EMG Free-run',
  'EMG Triggered (Estimulação)',
  'TOF (Train of Four)',
  'EEG (Eletroencefalograma)',
  'PEV (Potencial Evocado Visual)',
  'PEA (Potencial Evocado Auditivo)',
  'Mapeamento Cortical',
  'Mapeamento Subcortical',
];

export const CONDUTAS_ALARME = [
  'Aviso ao cirurgião',
  'Pausa da manobra cirúrgica',
  'Reversão da manobra (remoção de material, descompressão)',
  'Aumento da Pressão Arterial Média (PAM)',
  'Ajuste anestésico (bolus, alteração de drogas)',
  'Verificação técnica (eletrodos, cabos)',
  'Teste do TOF repetido',
  'Irrigação com soro morno'
];

export const CODIGOS_TUSS_SUGESTOES = [
  { codigo: '4.01.03.54-5', descricao: 'Monitorização neurofisiológica intra-operatória (até 4h)' },
  { codigo: '4.01.03.55-3', descricao: 'Monitorização neurofisiológica intra-operatória (hora adicional)' },
  { codigo: '4.01.03.61-8', descricao: 'Potencial evocado somato-sensitivo (PESS)' },
  { codigo: '4.01.03.62-6', descricao: 'Potencial evocado motor (PEM)' },
  { codigo: '4.01.03.63-4', descricao: 'Eletromiografia de campo operatório' },
  { codigo: '4.01.03.64-2', descricao: 'Monitorização de nervos cranianos / Mapeamento' },
];

export const CID10_SUGESTOES = [
  { codigo: 'M48.0', descricao: 'Estenose da coluna vertebral' },
  { codigo: 'M43.1', descricao: 'Espondilolistese' },
  { codigo: 'M51.1', descricao: 'Transtorno de disco lombar c/ radiculopatia' },
  { codigo: 'M50.1', descricao: 'Transtorno de disco cervical c/ radiculopatia' },
  { codigo: 'M41.9', descricao: 'Escoliose' },
  { codigo: 'C71.9', descricao: 'Neoplasia de encéfalo / Tumor cerebral' },
  { codigo: 'D32.0', descricao: 'Meningioma cerebral' },
  { codigo: 'D33.3', descricao: 'Schwannoma vestibular / Neurinoma' },
  { codigo: 'G56.0', descricao: 'Síndrome do túnel do carpo' },
  { codigo: 'T09.3', descricao: 'Trauma raquimedular / Fratura vertebral' }
];

