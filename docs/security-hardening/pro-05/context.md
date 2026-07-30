# PRO-05 evidence context

This is local working context for the distributable hardening portfolio in this
directory. The source tree was inspected at commit
`3f9fe4ec72216d7a659d68714989e17f3044c0c4` on branch
`codex/platform-ux-foundation`.

Local source root:

`C:\Users\guill\OneDrive\Documentos\GitHub\obrasaas\.codex-worktrees\platform-ux`

The input collection contains seven files. Its canonical collection digest is
`e8e594e8b1af31232ce23e080516922e91d8c6fe86d2307dc4737018320c44f8`.

| Evidence | Local source | SHA-256 | Bytes | What it establishes |
| --- | --- | --- | ---: | --- |
| E-PDF | `C:\Users\guill\Downloads\Documento_Especificaciones_App_Obra.pdf` | `0e2a52d79e0f0875f16cc24e30049d1359bc85589a68a9814be2b70d790dc3b5` | 26371 | Client requirements for worker, document, attendance, payment and operational data. |
| E-SCHEMA | `prisma/schema.prisma` | `f35eece932368ca91a53e328fe1c5f9ef0417fbfaa248ddf4597edb5fa080bb3` | 171184 | Current relational ownership, sensitive fields and delete constraints. |
| E-PUBLIC | `src/app/data-deletion/page.js` | `1b86448a327394e03ea41e5a15a06dad9a672286b6f86cc6ac3af56209253e8a` | 2917 | Public 30-day active-data and 90-day backup statements without a matching control plane. |
| E-PRIVACY | `src/app/privacy/page.js` | `7841aaf7e922d73a3aaff1b03688ee83ffc1c69a809b232e2d27288e7bb67ad5` | 9257 | Current privacy notice and manual contact path. |
| E-LOCAL-PURGE | `src/lib/worker-onboarding-retention.js` | `c20de196dcd879027d72a5f8ae25f0aa5bd26c54241eb1b7f0e952c32cbac9bb` | 7766 | A bounded, transactional and auditable cryptographic-erasure pattern for one transient domain. |
| E-TRACE | `docs/CLIENT_SPEC_TRACEABILITY.md` | `f6fc2c8750c73bc4a8d87f58a078405da26e30b330753d23b66396f75c5d2fef` | 40188 | PRO-05 is explicitly absent and gates real labour data. |
| E-WA | `docs/WHATSAPP_META.md` | `333c94df339e597dd13f472c1ca3e60df307367780039c98ddea759ce3b5341a` | 30138 | WhatsApp raw-phone and cross-domain deletion debt is already acknowledged. |

Primary regulatory references consulted on 2026-07-29:

- Argentina, Ley 25.326: https://www.argentina.gob.ar/normativa/nacional/ley-25326-64790/actualizacion
- Argentina, AAIP rights guidance: https://www.argentina.gob.ar/aaip/datospersonales/derechos
- Argentina, AAIP geolocation guidance: https://www.argentina.gob.ar/noticias/proteccion-de-datos-personales-y-geolocalizacion
- Brazil, Lei 13.709/2018 (LGPD): https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- European Union, Regulation (EU) 2016/679: https://eur-lex.europa.eu/eli/reg/2016/679/2016-05-04/eng

These sources guide engineering requirements but do not replace jurisdiction-
specific legal review of labour, tax, accounting or evidentiary retention.
