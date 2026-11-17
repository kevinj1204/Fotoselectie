import 'server-only';
import crypto from 'node:crypto';
import { query, tx, getExtraPrice, audit } from './db';
import { PROVINCES } from './constants';
import { validateSubmission, hasErrors, isValidHttpsUrl } from './validation';
import { isPast } from './time';

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function newToken() {
  return crypto.randomBytes(18).toString('base64url');
}

// Een deelnemer wordt binnen een shoot herkend aan voor- + achternaam (hoofdletters/spaties maken niet uit).
const NAME_KEY = (fn, ln) => `lower(regexp_replace(trim(${fn}) || ' ' || trim(${ln}), '\\s+', ' ', 'g'))`;

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Publiek                                                             */
/* ------------------------------------------------------------------ */

export async function getPublicShoot(token) {
  if (!token || typeof token !== 'string' || token.length > 64) return null;
  const { rows } = await query(
    `SELECT id, province, name, shootstack_gallery_url, deadline_at, allow_submissions_after_deadline, archived_at
       FROM shoots WHERE public_link_token = $1`,
    [token]
  );
  const s = rows[0];
  if (!s || s.archived_at) return null;
  const deadlinePassed = isPast(s.deadline_at);
  return {
    id: s.id,
    province: s.province,
    name: s.name,
    gallery_url: isValidHttpsUrl(s.shootstack_gallery_url) ? s.shootstack_gallery_url : null,
    deadline_at: s.deadline_at ? new Date(s.deadline_at).toISOString() : null,
    deadline_passed: deadlinePassed,
    closed: deadlinePassed && !s.allow_submissions_after_deadline,
  };
}

function publicSummary(row) {
  return {
    participant_number: row.participant_number,
    first_name: row.first_name,
    last_name: row.last_name,
    category: row.category,
    province: row.province,
    photo_code: row.photo_code,
    extra_photo_codes: row.extra_photo_codes,
    extra_photo_count: row.extra_photo_count,
    extra_photo_price_each: Number(row.extra_photo_price_each),
    extra_photo_total: Number(row.extra_photo_total),
    submitted_at: row.submitted_at,
  };
}

async function findDuplicate(client, { shootId, province, firstName, lastName, excludeId }) {
  const { rows } = await client.query(
    `SELECT id, 'name' AS reason
       FROM submissions
      WHERE shoot_id = $1 AND province = $2 AND deleted_at IS NULL
        AND ($5::uuid IS NULL OR id <> $5::uuid)
        AND ${NAME_KEY('first_name', 'last_name')} = ${NAME_KEY('$3::text', '$4::text')}
      ORDER BY submitted_at ASC
      LIMIT 1`,
    [shootId, province, firstName, lastName, excludeId || null]
  );
  return rows[0] || null;
}

export async function submitParticipant(body) {
  const token = String(body.token || '');
  const idempotencyKey = String(body.idempotency_key || '').slice(0, 80) || null;
  const shoot = await getPublicShoot(token);
  if (!shoot) throw new HttpError(404, 'Deze link is niet (meer) geldig. Neem contact op met de organisatie.');
  if (shoot.closed) {
    throw new HttpError(403, 'De inzendtermijn is gesloten. Neem contact op met de organisatie.', { closed: true });
  }

  // Provincie wordt altijd door de link bepaald, nooit door de browser.
  const { values, errors } = validateSubmission({ ...body, participant_number: '', province: shoot.province });
  if (hasErrors(errors)) throw new HttpError(422, 'Controleer de gemarkeerde velden.', { errors });

  const price = await getExtraPrice();
  const extraCount = values.extra_photo_codes.length;
  const extraTotal = round2(extraCount * price);

  return tx(async (client) => {
    // Serialiseer inzendingen per shoot zodat dubbele controles betrouwbaar zijn.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [shoot.id]);

    if (idempotencyKey) {
      const { rows } = await client.query('SELECT * FROM submissions WHERE idempotency_key = $1', [idempotencyKey]);
      if (rows[0]) return { ok: true, repeated: true, summary: publicSummary(rows[0]) };
    }

    const dup = await findDuplicate(client, {
      shootId: shoot.id,
      province: shoot.province,
      firstName: values.first_name,
      lastName: values.last_name,
    });

    if (dup && !body.confirm_duplicate) {
      throw new HttpError(
        409,
        'Voor deze naam is bij deze shoot al een keuze ontvangen.',
        { duplicate: true, reason: dup.reason }
      );
    }

    const { rows } = await client.query(
      `INSERT INTO submissions
         (shoot_id, participant_number, first_name, last_name, category, province, photo_code,
          extra_photo_codes, extra_photo_count, extra_photo_price_each, extra_photo_total,
          review_status, duplicate_reason, duplicate_of, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        shoot.id, values.participant_number || null, values.first_name, values.last_name, values.category, shoot.province,
        values.photo_code, values.extra_photo_codes, extraCount, price, extraTotal,
        dup ? 'possible_duplicate' : 'ok',
        dup ? 'Zelfde voor- en achternaam' : null,
        dup ? dup.id : null,
        idempotencyKey,
      ]
    );
    return { ok: true, changeRequest: !!dup, summary: publicSummary(rows[0]) };
  });
}

/* ------------------------------------------------------------------ */
/* Beheer – shoots                                                     */
/* ------------------------------------------------------------------ */

function intOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 100000) throw new HttpError(422, 'Aantallen moeten hele getallen van 0 of hoger zijn.');
  return n;
}

function parseShootInput(body, partial = false) {
  const out = {};
  if (!partial || 'province' in body) {
    if (!PROVINCES.includes(body.province)) throw new HttpError(422, 'Kies een geldige provincie/regio.');
    out.province = body.province;
  }
  if (!partial || 'name' in body) {
    const name = String(body.name || '').trim().slice(0, 120);
    if (!name) throw new HttpError(422, 'Geef de shoot een naam.');
    out.name = name;
  }
  if (!partial || 'shootstack_gallery_url' in body) {
    const url = String(body.shootstack_gallery_url || '').trim();
    if (url && !isValidHttpsUrl(url)) throw new HttpError(422, 'De Shootstack-link moet een volledige https://-link zijn.');
    out.shootstack_gallery_url = url || null;
  }
  for (const k of ['expected_participants', 'expected_teens', 'expected_misses']) {
    if (!partial || k in body) out[k] = intOrNull(body[k]);
  }
  if (!partial || 'deadline_at' in body) {
    if (body.deadline_at) {
      const d = new Date(body.deadline_at);
      if (Number.isNaN(d.getTime())) throw new HttpError(422, 'Ongeldige deadline.');
      out.deadline_at = d.toISOString();
    } else out.deadline_at = null;
  }
  if (!partial || 'allow_submissions_after_deadline' in body) {
    out.allow_submissions_after_deadline = !!body.allow_submissions_after_deadline;
  }
  return out;
}

export async function createShoot(body) {
  const v = parseShootInput(body);
  const { rows } = await query(
    `INSERT INTO shoots (province, name, shootstack_gallery_url, expected_participants, expected_teens, expected_misses,
                         deadline_at, allow_submissions_after_deadline, public_link_token)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [v.province, v.name, v.shootstack_gallery_url, v.expected_participants, v.expected_teens, v.expected_misses,
      v.deadline_at, v.allow_submissions_after_deadline, newToken()]
  );
  await audit('create', 'shoot', rows[0].id, { name: v.name, province: v.province });
  return rows[0];
}

export async function updateShoot(id, body) {
  const v = parseShootInput(body, true);
  if ('archived' in body) v.archived_at = body.archived ? new Date().toISOString() : null;
  if (body.regenerate_link) v.public_link_token = newToken();
  if ('province' in v) {
    const { rows } = await query('SELECT count(*)::int AS n FROM submissions WHERE shoot_id = $1 AND province <> $2', [id, v.province]);
    if (rows[0].n > 0) throw new HttpError(422, 'De provincie kan niet worden gewijzigd zolang er inzendingen uit een andere provincie aan deze shoot hangen.');
  }
  const keys = Object.keys(v);
  if (!keys.length) throw new HttpError(422, 'Niets om te wijzigen.');
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const { rows } = await query(`UPDATE shoots SET ${sets}, updated_at = now() WHERE id = $1 RETURNING *`, [id, ...keys.map((k) => v[k])]);
  if (!rows[0]) throw new HttpError(404, 'Shoot niet gevonden.');
  await audit('update', 'shoot', id, { fields: keys });
  return rows[0];
}

export async function deleteShoot(id) {
  const { rows } = await query('SELECT count(*)::int AS n FROM submissions WHERE shoot_id = $1', [id]);
  if (rows[0].n > 0) throw new HttpError(422, 'Deze shoot heeft inzendingen. Archiveer de shoot in plaats van verwijderen.');
  await query('DELETE FROM shoots WHERE id = $1', [id]);
  await audit('delete', 'shoot', id);
}

/* ------------------------------------------------------------------ */
/* Beheer – voortgang en totalen                                       */
/* ------------------------------------------------------------------ */

export function progressStatus(received, expected) {
  if (expected === null || expected === undefined || expected === 0) return { key: 'unset', label: 'Geen verwacht aantal ingesteld' };
  if (received < expected) return { key: 'incomplete', label: 'Nog niet compleet' };
  if (received === expected) return { key: 'complete', label: 'Compleet' };
  return { key: 'over', label: 'Meer inzendingen dan verwacht' };
}

export async function listShootsWithProgress({ includeArchived = true } = {}) {
  const { rows } = await query(
    `SELECT s.*,
            COALESCE(p.received, 0)::int AS received,
            COALESCE(p.received_teens, 0)::int AS received_teens,
            COALESCE(p.received_misses, 0)::int AS received_misses,
            COALESCE(p.submissions, 0)::int AS submissions,
            COALESCE(p.to_review, 0)::int AS to_review,
            COALESCE(p.extra_count, 0)::int AS extra_count,
            COALESCE(p.extra_total, 0)::numeric AS extra_total
       FROM shoots s
       LEFT JOIN (
         SELECT shoot_id,
                count(DISTINCT ${NAME_KEY('first_name', 'last_name')}) AS received,
                count(DISTINCT ${NAME_KEY('first_name', 'last_name')}) FILTER (WHERE category = 'Teen') AS received_teens,
                count(DISTINCT ${NAME_KEY('first_name', 'last_name')}) FILTER (WHERE category = 'Miss') AS received_misses,
                count(*) AS submissions,
                count(*) FILTER (WHERE review_status = 'possible_duplicate') AS to_review,
                sum(extra_photo_count) AS extra_count,
                sum(extra_photo_total) AS extra_total
           FROM submissions WHERE deleted_at IS NULL GROUP BY shoot_id
       ) p ON p.shoot_id = s.id
      ${includeArchived ? '' : 'WHERE s.archived_at IS NULL'}
      ORDER BY array_position($1::text[], s.province), s.archived_at NULLS FIRST, s.created_at`,
    [PROVINCES]
  );
  return rows.map((s) => {
    const expected = s.expected_participants;
    return {
      ...s,
      extra_total: Number(s.extra_total),
      remaining: expected ? Math.max(0, expected - s.received) : null,
      percent: expected ? Math.round((s.received / expected) * 100) : null,
      status: progressStatus(s.received, expected),
      deadline_passed: isPast(s.deadline_at),
      gallery_ok: isValidHttpsUrl(s.shootstack_gallery_url),
    };
  });
}

export async function getTotals() {
  const { rows } = await query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE category = 'Teen')::int AS teens,
            count(*) FILTER (WHERE category = 'Miss')::int AS misses,
            count(*) FILTER (WHERE review_status = 'possible_duplicate')::int AS to_review,
            COALESCE(sum(extra_photo_count),0)::int AS extra_count,
            COALESCE(sum(extra_photo_total),0)::numeric AS extra_total
       FROM submissions WHERE deleted_at IS NULL`
  );
  const per = await query(
    `SELECT province, count(*)::int AS n FROM submissions WHERE deleted_at IS NULL GROUP BY province`
  );
  const perProvince = Object.fromEntries(PROVINCES.map((p) => [p, 0]));
  per.rows.forEach((r) => { perProvince[r.province] = r.n; });
  return { ...rows[0], extra_total: Number(rows[0].extra_total), per_province: perProvince };
}

/* ------------------------------------------------------------------ */
/* Beheer – inzendingen                                                */
/* ------------------------------------------------------------------ */

export function buildSubmissionFilter(params) {
  const where = ['s.deleted_at IS NULL'];
  const args = [];
  const add = (sql, val) => { args.push(val); where.push(sql.replace('?', `$${args.length}`)); };
  if (params.shoot_id) add('s.shoot_id = ?::uuid', params.shoot_id);
  if (params.province && PROVINCES.includes(params.province)) add('s.province = ?', params.province);
  if (params.category === 'Teen' || params.category === 'Miss') add('s.category = ?', params.category);
  if (params.status === 'review') where.push(`s.review_status = 'possible_duplicate'`);
  if (params.q) {
    const q = String(params.q).trim().slice(0, 80);
    if (q) {
      args.push(`%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%`);
      const i = `$${args.length}`;
      where.push(`(s.participant_number ILIKE ${i} OR s.first_name ILIKE ${i} OR s.last_name ILIKE ${i}
                   OR (s.first_name || ' ' || s.last_name) ILIKE ${i} OR s.photo_code ILIKE ${i}
                   OR array_to_string(s.extra_photo_codes, ' ') ILIKE ${i})`);
    }
  }
  const dir = params.dir === 'desc' ? 'DESC' : 'ASC';
  const sorts = {
    participant_number: `NULLIF(regexp_replace(s.participant_number, '\\D', '', 'g'), '')::numeric ${dir} NULLS LAST, s.participant_number ${dir}`,
    last_name: `lower(s.last_name) ${dir}, lower(s.first_name) ${dir}`,
    submitted_at: `s.submitted_at ${dir}`,
  };
  const order = sorts[params.sort] || sorts.last_name;
  return { where: where.join(' AND '), args, order };
}

export async function listSubmissions(params = {}) {
  const { where, args, order } = buildSubmissionFilter(params);
  const { rows } = await query(
    `SELECT s.*, sh.name AS shoot_name, sh.archived_at AS shoot_archived_at
       FROM submissions s JOIN shoots sh ON sh.id = s.shoot_id
      WHERE ${where}
      ORDER BY ${order}
      LIMIT 5000`,
    args
  );
  return rows.map((r) => ({ ...r, extra_photo_price_each: Number(r.extra_photo_price_each), extra_photo_total: Number(r.extra_photo_total) }));
}

export async function getSubmission(id) {
  const { rows } = await query(
    `SELECT s.*, sh.name AS shoot_name FROM submissions s JOIN shoots sh ON sh.id = s.shoot_id WHERE s.id = $1`,
    [id]
  );
  if (!rows[0]) throw new HttpError(404, 'Inzending niet gevonden.');
  let original = null;
  if (rows[0].duplicate_of) {
    const o = await query('SELECT id, participant_number, first_name, last_name, category, photo_code, extra_photo_codes, submitted_at FROM submissions WHERE id = $1', [rows[0].duplicate_of]);
    original = o.rows[0] || null;
  }
  return { ...rows[0], original };
}

export async function updateSubmission(id, body) {
  return tx(async (client) => {
    const cur = await client.query('SELECT * FROM submissions WHERE id = $1 FOR UPDATE', [id]);
    const existing = cur.rows[0];
    if (!existing) throw new HttpError(404, 'Inzending niet gevonden.');
    const shootId = body.shoot_id || existing.shoot_id;
    const sh = await client.query('SELECT id, province FROM shoots WHERE id = $1', [shootId]);
    if (!sh.rows[0]) throw new HttpError(422, 'Onbekende shoot.');
    const province = sh.rows[0].province;

    const { values, errors } = validateSubmission({ ...existing, ...body, province });
    if (hasErrors(errors)) throw new HttpError(422, 'Controleer de gemarkeerde velden.', { errors });

    const dup = await findDuplicate(client, {
      shootId, province,
      firstName: values.first_name, lastName: values.last_name, excludeId: id,
    });
    if (dup && !body.confirm_duplicate) {
      throw new HttpError(409, 'Er bestaat al een andere inzending met deze naam in deze shoot.', { duplicate: true, reason: dup.reason, other_id: dup.id });
    }

    const price = Number(existing.extra_photo_price_each);
    const count = values.extra_photo_codes.length;
    const { rows } = await client.query(
      `UPDATE submissions SET shoot_id=$2, participant_number=$3, first_name=$4, last_name=$5, category=$6, province=$7,
              photo_code=$8, extra_photo_codes=$9, extra_photo_count=$10, extra_photo_total=$11,
              admin_note=$12, updated_at=now()
        WHERE id=$1 RETURNING *`,
      [id, shootId, values.participant_number || null, values.first_name, values.last_name, values.category, province,
        values.photo_code, values.extra_photo_codes, count, round2(count * price),
        body.admin_note !== undefined ? String(body.admin_note || '').slice(0, 1000) || null : existing.admin_note]
    );
    await audit('update', 'submission', id, { fields: Object.keys(body) });
    return rows[0];
  });
}

export async function deleteSubmission(id) {
  const { rowCount } = await query('DELETE FROM submissions WHERE id = $1', [id]);
  if (!rowCount) throw new HttpError(404, 'Inzending niet gevonden.');
  await audit('delete', 'submission', id);
}

/** Beoordeling van een mogelijke dubbele inzending. */
export async function resolveDuplicate(id, action) {
  return tx(async (client) => {
    const cur = await client.query('SELECT * FROM submissions WHERE id = $1 FOR UPDATE', [id]);
    const s = cur.rows[0];
    if (!s) throw new HttpError(404, 'Inzending niet gevonden.');
    if (action === 'replace_original') {
      if (s.duplicate_of) await client.query('DELETE FROM submissions WHERE id = $1', [s.duplicate_of]);
      await client.query(`UPDATE submissions SET review_status='ok', duplicate_of=NULL, duplicate_reason=NULL, updated_at=now() WHERE id=$1`, [id]);
    } else if (action === 'keep_both') {
      await client.query(`UPDATE submissions SET review_status='ok', updated_at=now() WHERE id=$1`, [id]);
    } else if (action === 'discard_new') {
      await client.query('DELETE FROM submissions WHERE id = $1', [id]);
    } else throw new HttpError(422, 'Onbekende actie.');
    await audit('resolve_duplicate', 'submission', id, { action });
    return { ok: true };
  });
}

export async function setExtraPrice(value) {
  const n = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 10000) throw new HttpError(422, 'Ongeldig bedrag.');
  await query(`INSERT INTO settings (key, value, updated_at) VALUES ('extra_photo_price', $1, now())
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [n.toFixed(2)]);
  await audit('update', 'settings', 'extra_photo_price', { value: n });
  return n;
}
