'use client'

/**
 * /about — QUÉ ES GRADIENTE. The project's own words (welcome copy, user
 * guide, manifesto — wiki/copy), set as one long document tuned across the
 * dial. System facts (half-lives, who publishes what, the rank rule, the
 * foro cap, the crowd threshold) are read from the running code.
 */

import Link from 'next/link'
import { VIBE_CHECK_THRESHOLD } from '@/lib/vibe'
import { HL_BRACKET_LABELS } from '@/lib/dashboard/hl'
import { ECHO_FACTOR, FORO_THREAD_CAP, HARVEST_MULTIPLIER } from '@/lib/store/world-core'
import { FORO_THREAD_GENRES_MAX, FORO_THREAD_GENRES_MIN, FORO_THREAD_TAGS_MAX, FORO_THREAD_TAGS_MIN } from '@/lib/types'
import { FormatGlyph } from '@/components/kit/Glyph'
import { Revelado } from '@/components/trama/Revelado'
import type { ContentType } from '@/lib/types'
import { CasaDoc, Flujo, Lista, P, Sub, type Apartado } from './CasaDoc'
import { FaderDemo } from './FaderDemo'
import { Rangos, Reacciones, Roles, VidaMedia } from './Sistema'
import styles from './Casa.module.css'

const CHAIN = ['Comunidad', 'Infraestructura', 'Memoria', 'Escena']

const CONVOCATORIA: Array<{ t: ContentType | null; name: string }> = [
  { t: 'editorial', name: 'Editorial' },
  { t: 'articulo', name: 'Artículo' },
  { t: 'opinion', name: 'Opinión' },
  { t: 'review', name: 'Reseña' },
  { t: 'listicle', name: 'Lista' },
  { t: null, name: 'Foro' },
]

function Hero() {
  return (
    <>
      <h1 className="sr-only">Qué es Gradiente</h1>
      <blockquote className={styles.quote}>
        <Revelado as="p" className={styles.quoteText} trigger="load" preset="teletipo">
          «Treinta rayos convergen en el cubo de una rueda; es el agujero en el centro lo que la hace útil.»
        </Revelado>
        <cite className={styles.quoteCite}>Lao Tzu · Tao Te Ching, XI</cite>
      </blockquote>
      <p className={styles.thesis}>
        Gradiente es <b>infraestructura y memoria</b> para la escena underground de música y arte sonoro en México: un bien común donde la atención
        se comporta como física, no como dinero.
      </p>
      <p className={styles.chain} aria-label={CHAIN.join(', ')}>
        {CHAIN.map((w, i) => (
          <span key={w} aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', gap: 14 }}>
            {i > 0 ? <span className={styles.chainArrow} /> : null}
            <span className={styles.chainStep}>{w}</span>
          </span>
        ))}
      </p>
    </>
  )
}

const APARTADOS: Apartado[] = [
  {
    id: 'que-es',
    title: 'Qué es',
    motto: 'Personas, no plataformas.',
    content: (
      <>
        <P lead>
          La cultura no se transmite desde un punto hacia afuera: se construye cuando personas distintas convergen hacia un centro compartido por
          todos y definido por nadie.
        </P>
        <P>
          Gradiente es un foro descentralizado, inspirado en los message boards de los 90 y 2000, que funciona como refugio y respuesta a la
          cultura del algoritmo. Aquí conviven la agenda curada de eventos, el periodismo musical, las reseñas, las opiniones, los mixes, el foro
          y un mercado especializado. Todo parte de un hecho: la subjetividad de cada persona es valiosa y necesaria para un ecosistema sano.
        </P>
        <P>
          Por dentro hay un sistema técnicamente denso; por fuera, todo es intuitivo e inmediato. Los contenidos suben, bajan, crecen, se hunden
          y resucitan según lo que generan en la comunidad. Es un archivo vivo: las cosas no desaparecen ni se sepultan, se acomodan en sus
          nichos.
        </P>
        <P>
          <b>El archivo no tiene dueños. Solo custodios temporales.</b>
        </P>
      </>
    ),
  },
  {
    id: 'para-que',
    title: 'Para qué',
    motto: 'Cuando el mundo se desarma, la comunidad es la medicina.',
    content: (
      <>
        <P>
          Las plataformas que moldean cómo descubrimos y compartimos música fueron construidas desde otros centros culturales y con fines
          parasitarios: <b>extraen y no devuelven nada a la cultura</b>. Optimizan el tiempo de pantalla, aplanan el contexto local y convierten
          la música en etiquetas y contadores.
        </P>
        <P>
          La escena de la CDMX ya se curaba a sí misma desde adentro, pero su conocimiento vive en historias de Instagram, listados ajenos y
          grupos de WhatsApp: efímero, rentado, propiedad de alguien más. Gradiente parte de la realidad local — opiniones, eventos y
          asociaciones que nacen del contexto — porque aquí el discurso se refleja directamente en nuestro entorno.
        </P>
        <P>
          La intención es hacer esa realidad más sana: mejor conectada, mejor informada. Un espacio para el diálogo, la reflexión y una forma de
          promoción más personal y colectiva, sin alimentar a las plataformas que nos están desmoralizando.
        </P>
      </>
    ),
  },
  {
    id: 'calibracion',
    title: 'Calibración analógica',
    motto: 'Tecnología escondida. Formato análogo.',
    content: (
      <>
        <P lead>
          El género como único organizador de música es una mentira. Reduce lo que es continuo y separa lo que naturalmente conversa entre sí.
        </P>
        <P>
          Hay techno que medita y techno que detona. Hay jazz de tres de la mañana y jazz que es una pared de ruido. La etiqueta no te dice nada de
          eso. Por eso, arriba de cada sección hay un horizonte: un fader continuo de 0 (glacial) a 10 (volcán). Un solo gesto. Lo mueves y todo se
          reorganiza a esa intensidad, sin importar el género.
        </P>
        <div className={styles.wide}>
          <FaderDemo />
        </div>
        <P>
          Cada pieza propone su energía desde su autor, su contexto y su metadata; la comunidad la refina con su lectura. Cualquiera con sesión
          puede arrastrar su lectura sobre la escala de una pieza. Con {VIBE_CHECK_THRESHOLD} lecturas, la mediana de la comunidad se vuelve la
          banda de la pieza — cambia dónde aparece, no solo cómo se ve — y las marcas del autor siguen visibles, para que la distancia entre
          autor y comunidad siempre se pueda leer. A esto le llamamos <b>calibración analógica</b>.
        </P>
        <P>
          Arrastrar es el punto. Un toque para estar de acuerdo llenaría la mediana de gente que solo pasa scrolleando; deslizar y soltar filtra
          por atención. La fricción es el diseño, no un defecto.
        </P>
        <Sub>Half-life: la vida de cada pieza</Sub>
        <P>
          Cada pieza nace con su propia energía — su <b>HL</b>, half-life — que decae con el tiempo y se renueva cuando la comunidad la toca: la
          abre, la guarda, la comenta, la calibra. Sube, baja, cambia de tamaño, muere, resucita si alguien la discute.
        </P>
        <div className={styles.wide}>
          <VidaMedia />
        </div>
        <P>
          Tamaño y posición son las únicas señales visibles. No hay likes, ni seguidores, ni estrellas, ni “tendencias”. Una pieza se apaga
          encogiéndose y alejándose, nunca mostrando un número que baja. Y nadie ve un campo distinto: la única diferencia personal es invisible —
          lo que tocas fuera de tu costumbre empuja un poco más.
        </P>
      </>
    ),
  },
  {
    id: 'estructura',
    title: 'Estructura comunitaria',
    motto: 'Guías, no porteros.',
    content: (
      <>
        <P>
          Somos guías, no porteros. La redacción siembra — una pieza editorial nace con más vida y la portada es pequeña — pero la comunidad
          decide qué crece. Lo editorial compite en el mismo mosaico que los eventos y las contribuciones de todos: no hay un carril aparte para
          “la selección de la casa”. Si nadie toca lo que eligieron los editores, se apaga. Así debe ser.
        </P>
        <P>
          La voz se gana participando. Los roles suben de manera orgánica según tu enfoque, tu tipo de participación y lo que generas; cada nivel
          abre formatos. <i>Guía</i> es la voz de la casa; <i>insider</i> es la voz de la escena: mismos derechos, distinta firma.
        </P>
        <div className={styles.wide}>
          <Roles />
        </div>
        <P>
          Las etiquetas van en las personas, nunca como pesos sobre el contenido. Tu rol dice qué puedes publicar; no hace que lo tuyo pese más.
        </P>
      </>
    ),
  },
  {
    id: 'convocatorias',
    title: 'Convocatorias',
    motto: 'Tu gusto vale oro.',
    futuro: true,
    content: (
      <>
        <P lead>Esto todavía no existe. Así lo pensamos.</P>
        <P>
          Cada mes cerrará una convocatoria con un fondo destinado a fomentar el pensamiento crítico, el hábito de compartir y, sobre todo, un
          periodismo musical independiente y accesible. El fondo se repartirá por categoría, según el HL acumulado por las piezas al cierre del
          mes. Sin jurado: la comunidad decide.
        </P>
        <ul className={styles.bullets}>
          {CONVOCATORIA.map((c) => (
            <li key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {c.t ? <FormatGlyph type={c.t} size={14} /> : null}
              {c.name}
            </li>
          ))}
        </ul>
        <P>
          Después: HL canjeable y propinas directas entre personas, para que quienes sostienen esto vivo — escritores, curadores, gente que
          construye comunidad — ganen algo. El premio reconoce lo que la escena produce.
        </P>
      </>
    ),
  },
  {
    id: 'guia',
    title: 'Guía de usuario',
    motto: 'Todo empieza en tu taller.',
    content: (
      <>
        <Sub>Acceso</Sub>
        <P>
          Se entra por invitación, por La Puerta. Sin sesión puedes recorrer todo el campo; para publicar, guardar, calibrar o comentar
          necesitas entrar. Lo tuyo vive en el <b>Taller</b>: tu avatar, arriba a la derecha.
        </P>
        <Sub>Dos capas de identidad</Sub>
        <P>
          <b>Persona</b>: publicas con tu nombre, recibes reacciones y un rango que se mueve solo. <b>Franja</b>: para sellos, promotoras,
          colectivos y espacios — perfil propio, mercado integrado y un equipo con permiso para publicar desde el espacio de la franja. Pueden
          coexistir.
        </P>
        <Sub>Publicar</Sub>
        <Lista
          ordered
          items={[
            <>Taller → Publicar → escoge el formato. Si dudas, el más corto que sirva. ¿Por qué no una lista de tus discos favoritos?</>,
            <>
              Llena la mesa: un <b>título</b> concreto, sin clickbait; una <b>imagen</b>, obligatoria — sin imagen no hay póster; el{' '}
              <b>cuerpo</b>, con la música embebida y no solo enlazada; la <b>energía</b> de 0 a 10, obligatoria; los <b>géneros</b> que sí
              importan; las <b>etiquetas</b> que conectan — tres precisas valen más que ocho.
            </>,
            <>Guarda el borrador: es privado, solo tú lo ves.</>,
            <>Mantén presionado para publicar. Publicar es un compromiso: cuesta un gesto, no un clic.</>,
            <>Confirma con la vista previa final. La pieza nace.</>,
          ]}
        />
        <Flujo steps={['Borrador', 'Pendiente', 'Publicado']} />
        <Sub>Después de publicar</Sub>
        <P>
          Tu pieza nace con HL. Solo tú ves su vida, y en palabras: {HL_BRACKET_LABELS.join(' · ')}. Nunca un número. Puedes editarla o borrarla
          desde tu Taller.
        </P>
        <P>
          Una vez, cuando quieras, puedes <b>cosechar</b>: tomas el {Math.round(ECHO_FACTOR * 100)}% de la vida actual de la pieza y lo sumas a tu
          presencia; a cambio, la pieza se enfría {String(HARVEST_MULTIPLIER).replace('.', ',')} veces más rápido. Cultivar, luego cosechar.
        </P>
        <Sub>Guardar y calibrar</Sub>
        <P>
          Guarda cualquier pieza desde su tarjeta; tu colección vive en Taller → Guardados y solo tú la ves. Guardar también renueva la vida de
          lo que guardas. Para calibrar, abre la pieza y arrastra tu lectura sobre su escala: una lectura por persona, y la puedes cambiar.
        </P>
        <Sub>Comentarios y reacciones</Sub>
        <P>Dos reacciones, solo dos. Una por persona en cada comentario. No hay votos arriba ni abajo.</P>
        <Reacciones />
        <P>Las reacciones que recibes definen tu rango. Nombra una textura, no un estatus, y se mueve solo:</P>
        <div className={styles.wide}>
          <Rangos />
        </div>
        <Sub>El foro</Sub>
        <P>
          Un imageboard. Para abrir un hilo necesitas una imagen, de {FORO_THREAD_GENRES_MIN} a {FORO_THREAD_GENRES_MAX} géneros y de{' '}
          {FORO_THREAD_TAGS_MIN} a {FORO_THREAD_TAGS_MAX} etiquetas. Las respuestas son planas; &gt;&gt;id cita a alguien. Cada respuesta
          empuja su hilo arriba. Solo caben {FORO_THREAD_CAP} hilos abiertos: cuando llega uno nuevo, el más viejo se cae del muro.
        </P>
        <Sub>Lo que no tienes que hacer</Sub>
        <Lista
          items={[
            'No pelees por aparecer arriba. El HL lo hace solo.',
            'No pongas ocho etiquetas. Tres precisas valen más.',
            'No uses IA para escribir. Para ortografía, sí. Para pensar por ti, no.',
            'No tienes que saber escribir bien. Solo tener algo que decir y compartir.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'manifiesto',
    title: 'Manifiesto',
    motto: 'Todo tiene un centro.',
    content: (
      <>
        <P lead>
          Gradiente es infraestructura digital para la escena underground de música y arte sonoro en México. Un foro descentralizado que funciona
          como refugio y respuesta a la cultura del algoritmo. Todo bajo una misma lógica: el gusto subjetivo de cada miembro es lo que mueve el
          sistema. La visibilidad se gana por aportación, no por performance. Curaduría sin porteros.
        </P>
        <Sub>La música está mejor que nunca. La industria está rota.</Sub>
        <P>
          Hay más herramientas, más alcance, más géneros, mejores sistemas de sonido y músicos de todas partes viajando y tocando. Existe una
          especie de aldea global. Pero todo eso solo se premia si alimenta al algoritmo.
        </P>
        <P>
          La mayoría nunca vio los primeros días del rave, del grunge, del metal. No eran virales: eran contracultura, exactamente lo que después
          alimenta a la cultura mainstream. Esa contracultura fue absorbida por las plataformas que hoy controlan cómo nos enteramos de las cosas.
          Sin espacios descentralizados y abiertos no podemos coincidir en nada nuevo.
        </P>
        <Sub>El problema es el control</Sub>
        <P>
          Tenemos las herramientas para ser independientes: distribuir, imprimir discos, promover. Aun así, los músicos ganan menos que nunca. Las
          plataformas donde vendemos, hablamos y escuchamos música son precisamente las más dañinas para quienes la hacen y la escuchan. Está al
          revés.
        </P>
        <Sub>No hay clubs. Hay discotecas.</Sub>
        <P>
          Los espacios donde pasaba la conexión son cada vez menos y menos auténticos. Lo que queda son lugares donde la música tiene que
          adherirse a un formato alineado con los horarios de venta y consumo. El DJ o la banda es un servicio, no un artista: un objeto para
          ambientar el lugar.
        </P>
        <Sub>El ouroboros del algoritmo</Sub>
        <P>
          Las recomendaciones se entrenan con recomendaciones, y las mismas cosas siguen apareciendo. Lo local es inexistente y el contexto es
          nulo. Descubrir cosas más personales toma tiempo: es llegar a tener una relación con algo, no usarlo como ruido de fondo. Si vamos a
          escuchar responsablemente, también deberíamos entrarle de otra manera: dentro de un contexto, entregándole algo de nosotros.
        </P>
        <Sub>Cumplir la promesa de los foros y los blogs</Sub>
        <P>
          Después del boom de los blogs, donde cada quien compartía desde su propio mundo y su propia estética, nos volvimos una sociedad de
          medianía. Desaparecieron los extremos, las excentricidades, los gustos raros — y el periodismo musical hecho desde adentro, por gente de
          la escena para gente de la escena. Hoy lo mexicano nos llega traducido. Que el algoritmo te muestre algo no es descubrimiento.
        </P>
        <Sub>Las etiquetas mienten. Gravedad, no polarización.</Sub>
        <P>
          En el corazón del sistema hay un fader continuo de glacial a volcán: la única decisión que tomas para empezar a navegar. El fader
          convierte la jerarquización en un sistema análogo, promoviendo nichos naturales en vez de polaridad algorítmica. Entre el filtro local y
          el feedback análogo se elimina la grasa de las plataformas convencionales; lo que queda es un entorno para leer, escribir y reflexionar.
        </P>
        <Sub>Desde aquí</Sub>
        <P>
          Gradiente nace en México, empezando por la CDMX, con la mira puesta en Latinoamérica. Las plataformas que hoy moldean cómo descubrimos y
          escuchamos fueron construidas desde otros centros culturales: referentes eurocéntricos que pretenden ser globales. Nosotros no
          necesitamos traducción. Por locales, para todo el mundo. Comunidad, democratización, decolonización.
        </P>
        <Sub>Sin IA. Sin performance.</Sub>
        <P>
          Sin texto generado por IA, sin música generada por IA. Personas reales, conversación real. Queremos que la gente escriba, piense,
          investigue, entreviste, haga listas, opine, pregunte. No importa qué tan bien escribas: importa que tengas curiosidad y que aportes desde
          tu propio centro.
        </P>
        <Sub>Vida orgánica del contenido</Sub>
        <P>
          Cada cosa que entra a Gradiente tiene vida. No vive para siempre arriba ni se entierra al día siguiente. Lo que se calibra, se comenta,
          se comparte, vive más; lo que nadie toca se hunde por su propio peso. Tamaño y posición son las únicas señales visibles. La curaduría es
          el peso, y el peso se ve directamente.
        </P>
        <p className={styles.pull}>
          Esto es infraestructura que la escena posee, antes de que alguien más la construya y la posea por nosotros.
        </p>
        <P>
          Hay un borrador aparte, más corto, que la redacción sigue escribiendo: <Link href="/manifesto">el manifiesto editorial</Link>.
        </P>
      </>
    ),
  },
]

export function Acerca() {
  return (
    <CasaDoc
      kicker="Qué es Gradiente"
      hero={<Hero />}
      apartados={APARTADOS}
      colofon={<p>GRADIENTE · CDMX · 2026 — hecho por personas, para la escena.</p>}
    />
  )
}
