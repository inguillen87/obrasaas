// Exact budget-source CI declaration; compiler fills immutable reviewed source bindings.
export const PLAN_BUDGET_CURRENT_REVISION=Object.freeze({
  "version": 1,
  "status": "REVIEWED_SOURCE_ONLY",
  "finalAstDerived": true,
  "predecessorSource": {
    "baseCommit": "2148772241e9ed724d46a4e8f3f4888e4677fa1e",
    "reviewedCorrectionResultSha256": "d0960e36ee385cf5d92e19bbf7b6798e1a832a29bffe9fe193bee57b58277463"
  },
  "previousContractSha256": "8b19235b22aa3c208098283537511fe1c816f7ff86404790a98999f0e818f839",
  "references": [
    {
      "path": ".github/scripts/verify-workspace-ci-parallelization.mjs",
      "previousSha256": "8d65b7fb1446dc0533f69097ae28598a7c748f50c19eb586614ce078bf3aebac",
      "currentSha256": "b2788a2dd967624c1a2548ff32242a17a2fefffbaa6836e74efdc8132d69e1df"
    },
    {
      "path": ".github/workflows/company-usage-proxy.yml",
      "previousSha256": "e022e110819be01b20563d09ca8f8934a2ce367ce3029eb6cae16ee362af609c",
      "currentSha256": "68e1940961c836503242c448a4391a415b42c0223efd6aee2457a890d418999b"
    },
    {
      "path": ".github/workflows/workspace-acceptance.yml",
      "previousSha256": "82075780c9ddb9530b47697ff0cacff6c4e73c0aba06999ab945151d7ff14858",
      "currentSha256": "c4901cffac7886050892a358181a66307986725653067f953e10e575f2e20cc4"
    },
    {
      "path": "scripts/lib/attendance-review-current-ci-proof.mjs",
      "previousSha256": null,
      "currentSha256": "111ae3206f3224bbc2f58ac3b9a77127fccdbf77c4cc59ddeec95b8ae01865f5"
    },
    {
      "path": "scripts/lib/home-decisions-current-ci-lineage.mjs",
      "previousSha256": "0f7f9ac5f194ece14a65c5a1ca80ada1bb695be26766a9fbe7fbdc19efc0be6f",
      "currentSha256": "bd61edf4351e0d3b8f7857cb26cdc169162dca5400467f2f9fbfbd5853903503"
    },
    {
      "path": "scripts/lib/material-review-current-ci-lineage.mjs",
      "previousSha256": "805e35504f147f017b4e70889c29c92175a4673f03916630319f6f25d040c4b4",
      "currentSha256": "54bafcc5ec399197f2b3b22e6dcf2f0aa31ff18f0d2727688954533f8dc4ecc7"
    },
    {
      "path": "scripts/lib/plan-budget-browser-ui.mjs",
      "previousSha256": null,
      "currentSha256": "67ca623eef0518314e53f7a92ec19f818f698b620f0e22833a27593e5a08f5a1"
    },
    {
      "path": "scripts/lib/plan-budget-current-ci-lineage.mjs",
      "previousSha256": null,
      "currentSha256": "834a40911ef64844f0db441a48cef5de235ae556c301308a62ff347f7106d678"
    },
    {
      "path": "scripts/lib/plan-budget-ui-contract.mjs",
      "previousSha256": null,
      "currentSha256": "dbe42180825c5fb17e99df81549cc2e5db3782f2112f8d4df5567624022798e4"
    },
    {
      "path": "scripts/lib/plan-measurement-current-ci-lineage.mjs",
      "previousSha256": "19addbc7ba23c963c2a1a9fae59fbc8cb2658f94d345cc7b731a5d9648dce818",
      "currentSha256": "d8fb88fffd808ba4fa0ceeb561a8224589adf1f01a4258ee896d8a94dd3e93c9"
    },
    {
      "path": "scripts/lib/plan-partida-preview-current-ci-lineage.mjs",
      "previousSha256": "66fa40633e2900a35073bed5b8f6a48b3402e3ab34703b3d47af3b68ae90fd08",
      "currentSha256": "141f5d6decf74d9dc126399ac955ac27874da785fd6c5df5f8af7bc0244d4e75"
    },
    {
      "path": "scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs",
      "previousSha256": "5960b4acedd880ac0a49f157e57007863c2478ad218e504eb81bf993ad54b147",
      "currentSha256": "a1de3a73617de7c4eb2f9db8665650abe5798accb44b886cd8d2220fe5295bbf"
    },
    {
      "path": "scripts/lib/worksite-live-hours-current-ci-lineage.mjs",
      "previousSha256": "86c626156b82419640b4dc45520a7dcca330810949a346ae60f50566a136f2e6",
      "currentSha256": "c78c0792ec6c9142b76090bdffc65fc026a5b333a473e833a203981bec96f448"
    },
    {
      "path": "scripts/verify-company-channel-postgres.mjs",
      "previousSha256": "500d3b39c03295b1c10ea1aed48bcbb5d3171f39370947fc9e5d657f23985079",
      "currentSha256": "d7314b1f7bc11d6cd5d56c6be2f4152ce6b8d3362c79418f16ae5ffaed9d4267"
    },
    {
      "path": "scripts/verify-employee-intake-postgres.mjs",
      "previousSha256": "d571468725a6679b4f03ea78c5a7be187514f616c2e2248d66e62b97dafe1284",
      "currentSha256": "66e406926448dc904316728d33c1d1f6cbc38a356e13bc0adee535b0c8427caf"
    },
    {
      "path": "scripts/verify-field-operations-postgres.mjs",
      "previousSha256": "c3cf9eed8983b9ab43ad9b11cf0f59af206b08ba70f5e6697133bb448b940662",
      "currentSha256": "4eb11afda80e9274e3fecdc229d12f21d53d29d444e6932e44837f257800ccc2"
    },
    {
      "path": "scripts/verify-field-operations-ui.mjs",
      "previousSha256": "c32dab6e6c5ba4619a04a2edada3a8656b22455f3a8e6a96d2bdf3b340d2d38f",
      "currentSha256": "e73541c962d7dab349b4ce3425591472ecce51b7ad1b74bdb483adacd786a5cc"
    },
    {
      "path": "scripts/verify-material-inventory-postgres.mjs",
      "previousSha256": "56c2c4751825349b126d26bc48fcce0557f11b779f94b3fad45985f34bbc409b",
      "currentSha256": "c046f5bae2f922bcf83b3f2dffc53ad36f10a9dcc1e57bbd73923176d1bf8093"
    },
    {
      "path": "scripts/verify-material-inventory-ui.mjs",
      "previousSha256": "63713aae240745041b3ce9e1bd5e412a9a3a855c8e8c8ad738a3ad91cd6a5fa6",
      "currentSha256": "ffcc82738e4620a196bab170b6ae9052df088297128273182cce8c785e6f9739"
    },
    {
      "path": "scripts/verify-meta-customer-coexistence-postgres.mjs",
      "previousSha256": "fd94401af9a07866a2cd28a355b7f2f69ef122cf3ae325690c8ffc35cb97092a",
      "currentSha256": "463875f2b3a12df09847a2de5dcd2b3b87e0df7a043303ca76bb754266c7929f"
    },
    {
      "path": "scripts/verify-meta-field-bridge-postgres.mjs",
      "previousSha256": "1580fcf08d81f0778cb4240215060d51f321671eba2d1b2d72aac7f800d3ee63",
      "currentSha256": "79b904814356166aac925e6d38d9b4a16a1f7009432b963b48d7c5a3f71aa62d"
    },
    {
      "path": "scripts/verify-plan-budget-ui.mjs",
      "previousSha256": null,
      "currentSha256": "15c3bd2cc174a773dcc1a9e2aaa289cc60bb7a3b6f3a1a84606180d1bcaace60"
    },
    {
      "path": "scripts/verify-plan-import-boundary.mjs",
      "previousSha256": "86518c0dda14a18d04bf20c393f32014ba7af11e76fe507b5999c4ec25d4cd84",
      "currentSha256": "3885b3343011502123d7ec1996c8d230a630a97b8522bcca5c9b6f7a9b164c11"
    },
    {
      "path": "scripts/verify-plan-import-ui.mjs",
      "previousSha256": "57534d93a1e0b675e11faec0750a51d1867f9c823e2b91a11143c0f8d297b38f",
      "currentSha256": "d85d5f2d21f3da43dcb66216d05798d9b2b5cdf2134b212be493a386a00301af"
    },
    {
      "path": "scripts/verify-plan-measurement-ci.mjs",
      "previousSha256": "314cfdc84accb072c82ef9de3dc13557a7594e8b1461031aa71a79d94b7de35d",
      "currentSha256": "8e86d0637c09d1a0fe907999997f4683f35bd4e17469e1dc36bd66ad75bd3552"
    },
    {
      "path": "scripts/verify-workspace-ui.mjs",
      "previousSha256": "cac2856aa357d6805da6438c995e5dd26748d5c92ab415ab2039b4508bbf79dd",
      "currentSha256": "31f4dbf6f43f0c05840c51f3d92526426f0b44940a1b1434c0ed3da24c2a4990"
    },
    {
      "path": "src/app/(identity)/cuenta/field-media-preview.js",
      "previousSha256": "d39d47da18f60c69a38eee22b62929087a7cc0b379a620af8a83b62573161110",
      "currentSha256": "61506157217af690aa3ea649a2472f99acc24ec96aa10eda3cc25d24a8108441"
    },
    {
      "path": "src/app/(identity)/cuenta/field-operations-panel.js",
      "previousSha256": "69af7d8b95378f0b7f26f880eaec61d891c38744e9e6781eca9fe539776a91ed",
      "currentSha256": "5477d459da2e68688ce3bcf68f8f928ab0a4155144696abb2736f0c511fcd455"
    },
    {
      "path": "src/app/(identity)/cuenta/field-review-page-view.mjs",
      "previousSha256": "18f3616144c03aacf9c9859ae210150d92f6838de7332cee2550fa5fe91603fb",
      "currentSha256": "a1187150e0a3344666418b0191a898a6cf019ad2e8e5c46be2be721aee969634"
    },
    {
      "path": "src/app/(identity)/cuenta/material-inventory-panel.js",
      "previousSha256": "0faadb854099ef161b9c869cc2b4c0aeb16d102e59fcaca8ef27fecd614d2924",
      "currentSha256": "f910384fa3acc4326037b4a4b0c141c1712cb95845f14d8d975705463fecd2e2"
    },
    {
      "path": "src/app/(identity)/cuenta/material-inventory-view.mjs",
      "previousSha256": "8b987424dd1db2332cbb26f792e51c8fea286bd5440f4d3235809e3869722b83",
      "currentSha256": "8942cb9a2f3ed071a77a9e87ca3876fa16b1f819bcb74f395e4307f7c167605a"
    },
    {
      "path": "src/app/(identity)/cuenta/plan-import-panel.js",
      "previousSha256": "d74f0cdff0da1c173bc2ef566fed973ca02dd6bcc449aa8c3842d5109954d5f6",
      "currentSha256": "19b79557ed1fa8d5db6d1a46201d925ea1ffc601cedb100da42bfe0768410dbf"
    },
    {
      "path": "src/app/(identity)/cuenta/plan-partida-budget-preview.js",
      "previousSha256": null,
      "currentSha256": "89868285a7cdd7a8e6f024d2e4924d45f3c811c7a24c4afe4655611f21998c15"
    },
    {
      "path": "src/app/(identity)/cuenta/plan-partida-budget-preview.mjs",
      "previousSha256": null,
      "currentSha256": "b6f64911f619ca1f999a4fffbb26c97b94c85e33bc49bd251d55676dd63208fa"
    },
    {
      "path": "src/app/(identity)/cuenta/plan-partida-source-preview.js",
      "previousSha256": "0869d7e7a5efe5e05e7b5f5f729da9e58d9f106329e31baf6ea79cabf990d3a9",
      "currentSha256": "a37e9dc27ecc12271c1043d42ca2c3311f66cae7c3fdae6bf961f67bd639e431"
    },
    {
      "path": "src/app/(identity)/cuenta/plan-partida-source-preview.module.css",
      "previousSha256": "da7cfec61d043d0f217e706701994fb41ed1973733ccd37a35698f743aefd9ee",
      "currentSha256": "301f578a68afa6878e67341f02a47b405444cea63eb6ae44eb86241b1c0da799"
    },
    {
      "path": "src/app/(identity)/cuenta/workspace-client.js",
      "previousSha256": "2fe5a56a7caf7d46f11e4292d2e145e3e72072198a09f9951ace42c2613e8db9",
      "currentSha256": "300e6c7f293ecc102b313c395d6e23fb520618435cf7cf5fe78e8c333e9f7cf8"
    },
    {
      "path": "src/app/(identity)/cuenta/workspace-overview.js",
      "previousSha256": "456e78d9e5c729182e65cd30141af37a5a6571d05261896ab5e19e39c4951c1b",
      "currentSha256": "b895bbe6bd6a0186f8600edd7e335b2239dc6f05c43f6c7c514a02a1a6964fc2"
    },
    {
      "path": "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
      "previousSha256": "060e128b54eefdadfbabac45c3ec696934f5e74d79b9e26e905081128e8e99c5",
      "currentSha256": "3a8d1c517fb084df425198c84671f6b76bb1f659f9d0d4ed94945cd1046d8e64"
    },
    {
      "path": "src/app/(identity)/cuenta/workspace.module.css",
      "previousSha256": "339fee2591a341bbb7839a19d55a5c298c728ef1de38a2efc3680999f4636db4",
      "currentSha256": "dfce6eb468fee571af0d0f371e68848274f22198faf89c0a6cdd5df5edc7e7a9"
    },
    {
      "path": "src/app/privacidad/identidad/page.js",
      "previousSha256": "7d69fb5e9327426e4ca9b7e856d38811babe5f43bfdad4b5bcb40266b88cc401",
      "currentSha256": "2b01990552d4ff067d389a75128b9d8290af15ccaeb69e5c06fac5e896998945"
    },
    {
      "path": "src/lib/field-media.mjs",
      "previousSha256": "940e681d1430fc211093b16f5407637fcd31d270a3d99234f748fe7db73cc0bb",
      "currentSha256": "d221ab87c4639aadb6eb8788a7203cee072f6eb1deca40605fc3d02742ab9d65"
    },
    {
      "path": "src/lib/field-operations-http.mjs",
      "previousSha256": "df60181e3d852efe42d86a284ced3c0ff9cf4c7fbcaf863de8da4d47c2f7aeaf",
      "currentSha256": "cd1773bc3b9fba01821cd4494b8559bdcdcc3a4ce886228622bb800349dcfd39"
    },
    {
      "path": "src/lib/field-operations-policy.mjs",
      "previousSha256": "01eb863d7db4446eeb8dab990d7e0602a19d581d5615a0b1e5d50c02f3d70173",
      "currentSha256": "bb33655b622a081de656f24c2e369fe7a2e05a0a0a9da7ffe455c2f39fd8fbd5"
    },
    {
      "path": "src/lib/field-operations-store.mjs",
      "previousSha256": "dbf96641349efae61808a2d66a02d491ad06e2226885e6efa928dba53ce5034e",
      "currentSha256": "517267adb96c69bce58350b98b3a4e335ca1304a72a824e35998590e95b8987c"
    },
    {
      "path": "src/lib/material-inventory.mjs",
      "previousSha256": "4b599d273c4cadcdf76202554757583152da8c11b0a754be386bffb830f0c65b",
      "currentSha256": "3af0b0e9c9003d09582ec4e8b21d1e35746dd3839fc7f01071935b9a4ea95333"
    },
    {
      "path": "src/lib/meta-consumption-evidence-catalog.mjs",
      "previousSha256": null,
      "currentSha256": "cd4eb1ccf8617060aa2bb352cc9467981f7d17649be8b24233413c133c407bff"
    },
    {
      "path": "src/lib/meta-customer-coexistence.mjs",
      "previousSha256": "30f5b950284b953fa853b37514cd768660cfc505a6e979ec51c947b6edce40da",
      "currentSha256": "2cf704b2d3842d4ff7ae48a438c1271ad610ccf4e92a6214d97338e91e999c8e"
    },
    {
      "path": "src/lib/meta-customer-provider.mjs",
      "previousSha256": "b6cc572fb68ab4cb653ccee30cea754a6273b5631d13e61dd2c2f65535aa287f",
      "currentSha256": "102ae45ad7d0a1054d2c65cdbfa3a6a96accfcd982bebce8d6c32c7bf24b21a2"
    },
    {
      "path": "src/lib/meta-employee-intake.mjs",
      "previousSha256": "77dc9f64814f995d21084606d705f26af65de4f4f9bea25a0f37a0d8dba1b928",
      "currentSha256": "72e80601323adbe35c9ec1f61e49e3428007da55e567c724ca8dce3c42de042b"
    },
    {
      "path": "src/lib/meta-field-bridge.mjs",
      "previousSha256": "79c961cf91f988e5d913cfb241a887c26a78d49e04ebf2c5fbb2bf6a74bc809b",
      "currentSha256": "7f3bb80ba828e202f24e1d768b855131642dcc89fde39fcac4b81d64aa632955"
    },
    {
      "path": "src/lib/meta-field-conversation.mjs",
      "previousSha256": "2da5b4a58e4f62a912d4df4bd93574c9907c6561123fe5ffabdd12420b72047f",
      "currentSha256": "c68887db8fa04f5806d1c0f4c29e829befb89931b8371041ad65334deb1dab4d"
    },
    {
      "path": "src/lib/meta-kyc-conversation.mjs",
      "previousSha256": "75870a6359385ae83df0d154b57c3f6738f2bde62fbe4974da7e38e5b0de2902",
      "currentSha256": "17d1e52e826dcaa899e2e6b846e2856c73f73b18b7abfe30e951de0de8623ef6"
    },
    {
      "path": "src/lib/operations-status.mjs",
      "previousSha256": "cdee54c539106c384a92c70c730c91cd3058e872d5d855c57150b8ad246e666a",
      "currentSha256": "ce05f2b18facdaa2df35274004ee2111be366056ef1ff2c593660b8490782cd6"
    },
    {
      "path": "src/lib/participant-kyc-notice-links.mjs",
      "previousSha256": "1a10acf655796ebf4f08175158ea3dc2a1d0a0fdb3d13bb88573d6a0e5f4375e",
      "currentSha256": "3547f3fc2ebdefc2522971467d4c77498160dde7806a25bf9fa18c527c8658fc"
    },
    {
      "path": "src/lib/plan-budget-source.mjs",
      "previousSha256": null,
      "currentSha256": "7ebeabf62d8fb89c6ab941b8130d196ca2e008959a9599f2db0c71d75dd3382a"
    },
    {
      "path": "src/lib/plan-import-analyzer.mjs",
      "previousSha256": "0427c7fbdf0ba27b07c328661e52731c996e0a7b5f0749dcc6207410b28c52bb",
      "currentSha256": "a132a09a7f69f218a244a46f55b9da9d873bae33c753f9d73c8c15a7daaeb9c0"
    },
    {
      "path": "src/lib/plan-import-http.mjs",
      "previousSha256": "92d74f6ca5e726f85f823e0b432f453895fcf7bd6d8cde1874f466b662446f2b",
      "currentSha256": "6bab716742d634eb11abbcb7b791507084c0c345cf98e7012668993be4deec1c"
    },
    {
      "path": "src/lib/plan-import-ooxml.mjs",
      "previousSha256": "a146b9b300086bd8f44af6549d75611f7ac542a6c6c2f9eddf099cd8fc0f9251",
      "currentSha256": "662abaa7523d74961c6873a8b0beb3eb7e3d3b52988fad9cc55e76c0e540a3bd"
    },
    {
      "path": "src/lib/plan-import-policy.mjs",
      "previousSha256": "f2d73b8c58df571fb0dc6e5d76e2fb5d60daffa6ed6a41bc2be3c7e536458696",
      "currentSha256": "1946b2793d0db11519d154acdb5bf0f7e8be5dc26ecd1971b846eed284d7d50f"
    },
    {
      "path": "src/lib/plan-import-store.mjs",
      "previousSha256": "455c06e64301b2679e1278cc288cd4b06c875a222339e15c6720c58bc1f011c2",
      "currentSha256": "da047723f790c0f5e7eeff855782e4db7463670d1875caf0bab1c6cce9b1a920"
    },
    {
      "path": "src/lib/voice-consumption-draft.mjs",
      "previousSha256": null,
      "currentSha256": "b9af424825674ca6f24a729e9ba89bae6e67adf433de10837a05e58900584c82"
    },
    {
      "path": "tests/fixtures/plan-budget-source-synthetic.mjs",
      "previousSha256": null,
      "currentSha256": "bf66364fbf41037c535c33b3aac59c750c2e19bf2a757c6564ac47b51665f241"
    },
    {
      "path": "tests/fixtures/plan-budget-store-synthetic.mjs",
      "previousSha256": null,
      "currentSha256": "86f8ba219c29aa70298c9998b45cd0e66c888cc277690ad43c28f30d47fd88d1"
    },
    {
      "path": "tests/fixtures/plan-budget-ui-synthetic.mjs",
      "previousSha256": null,
      "currentSha256": "e6e03b516d0301717c3f8daa0711c46610efb672eb4c7e83efcaf69959903bb3"
    },
    {
      "path": "tests/fixtures/plan-budget-weekly-164-runtime.json",
      "previousSha256": null,
      "currentSha256": "ac1e1e5f5d538b304987b1fd4ad6ebff766a7b2175ffc5b53cb785bc9917d416"
    },
    {
      "path": "tests/fixtures/plan-measurement-ci-unit.mjs",
      "previousSha256": "0dc1675460a96cb54cc0da2bcc64bfccaa704295543c4f632b742a244d917d93",
      "currentSha256": "00962b4a0404a3a9e17cf8bb9910a3b3345790ee6a8feccec4c8b839351986cf"
    },
    {
      "path": "tests/production-company-kyc-outbound-compact-ci.test.mjs",
      "previousSha256": "f5cf6fc2dd327058ca2e22196ab0bb9dfc436914f1eb39a0f1a8b8ef6b7c66f1",
      "currentSha256": "900baee8384af0b1dd02f19cbb200406e9f0e3adc56a4ac67ff344ce2cb152e4"
    },
    {
      "path": "tests/production-field-attendance-review-query.test.mjs",
      "previousSha256": null,
      "currentSha256": "c0a2d6aa4d0b8418d23392ace1024b7654f153f2627326f95649f04d53279d17"
    },
    {
      "path": "tests/production-field-outbound-current-ci-lineage.test.mjs",
      "previousSha256": "ca1f7fa23d0247aa994693eeec90ae019c20408e6e97ea9496507904cd8bc631",
      "currentSha256": "0182c754008d2aa1e507dcdf7d2a5d9a47c348553e0d947453bac4e0c9e5914a"
    },
    {
      "path": "tests/production-home-decisions-current-ci-lineage.test.mjs",
      "previousSha256": "511f6c45d33d66a22a7f583fd48c7ea7d4933dab26473d2106ece15056e4f6c7",
      "currentSha256": "f75e45a89eae56fea683cc536adf7d31855ea7bdd59e9a91e55df5ee362ae267"
    },
    {
      "path": "tests/production-integrated-identity-current-ci-lineage.test.mjs",
      "previousSha256": "c0e1179a42bc106ad08b24e20470670c61b0b83b52c62cf4533322ce1ae6a157",
      "currentSha256": "f9d99f05fa5dceacba18bc7168ce39d05de7bfd795cb3960ec8eacf4b80372c4"
    },
    {
      "path": "tests/production-kyc-reply-feedback-ci.test.mjs",
      "previousSha256": "854f34aff294e610915ce9078a1739121c646ba4f985ba20c7873c8c8826beaf",
      "currentSha256": "739b4bc21c9d7ecc0117df107e9e248bbd6aae5805c3c38e71643c8639b1535a"
    },
    {
      "path": "tests/production-kyc-reply-feedback-current-lineage.test.mjs",
      "previousSha256": "8cc78b2332c9c280cb45d8805baeae2371f209801394b9cc758312e7ef8a8d71",
      "currentSha256": "c536c5c9defcb8bb02ce7b5a6a1a2c7832b536cda9104838e02e1a2acc97857a"
    },
    {
      "path": "tests/production-material-consumption-feedback-ci.test.mjs",
      "previousSha256": "b8a85bd426a354c5914ed911d7dac70fd54a0b285ff90141d7c33d8592a29708",
      "currentSha256": "c74a5abdab43a5cf20b9df52da56573e9e702e3af2eb556f838ac447d1583cd4"
    },
    {
      "path": "tests/production-material-inventory-queue-panel.test.mjs",
      "previousSha256": "55163e14985c43164dac680cf431b7dee79ed1c166ca0c1131003cf838078460",
      "currentSha256": "a3df358d40d2a03571dcadac8e69f469698b9bfdfd14670554bc10df9ae6d3bb"
    },
    {
      "path": "tests/production-material-review-current-ci-lineage.test.mjs",
      "previousSha256": "a9d434e05848d2d2170d57a9410c8ddeecf4585949a645cb1fdf0480b2e58db9",
      "currentSha256": "f712f12c2396e2bc87ab108f0bd63a4caf0dd7faacfc21cde5cafdfeaa564db3"
    },
    {
      "path": "tests/production-meta-existing-api-plan-current-ci-lineage.test.mjs",
      "previousSha256": "dabe6caf8e2a216aa1d7160551431ce3e3b198b09b397f8c10edfeb9d9928650",
      "currentSha256": "00d21d855c36f8020bd1791ed3b48b90901f7e017c0611d2df33a3a13ab1978d"
    },
    {
      "path": "tests/production-meta-routing-discovery.test.mjs",
      "previousSha256": "42e273574d66cb692ba391c1d278a69b7adda3b12b7c0319603a8a8024054b8f",
      "currentSha256": "2d7f5673b05bddda2e1b34bb455d3f2b019b6ba6b23551c793202b414072e174"
    },
    {
      "path": "tests/production-ooxml-accounting-current-ci-lineage.test.mjs",
      "previousSha256": "35a12ce84a67245d0c96a059c741c8eff29711d71896be1774b88c76e975be55",
      "currentSha256": "4128c77d310d613cfa22f7480bd00ca041686507fb3619aafe941419144bdb86"
    },
    {
      "path": "tests/production-operations-status.test.mjs",
      "previousSha256": "4185d2b01cd1a142b846ee05067e38ae4dad60f90ae7dc0288f19cdddd77adf9",
      "currentSha256": "7768477fc2c986e252a4546ca74c8ce191e55dc2e03b88356dc4aad4c0ecd416"
    },
    {
      "path": "tests/production-organization-usage-ci.test.mjs",
      "previousSha256": "1f4aa949f2d05d83239560a4fa18223bfb910e85439ba14124882490bc8f36c3",
      "currentSha256": "b06e53cf706b97288cb6eb360226bbd7c72e0568cdb167408c482fae13ec7c6b"
    },
    {
      "path": "tests/production-participant-kyc-notice-links.test.mjs",
      "previousSha256": "f2096aceb507eec4782e3c457e49c11089805a92d09f13b9669c41e5c458e737",
      "currentSha256": "55b7fa081cbdaea01487865e60d5390031e568a3c8dc1b59e2fff6126321183d"
    },
    {
      "path": "tests/production-participant-kyc-notice-page.test.mjs",
      "previousSha256": "4bbd193893af0f8fef000cfdc35276cff1caad796f7246372f3d874de40ea184",
      "currentSha256": "59c99a827a02006aad99b55fa875861646c66fc9b324a0a1460d7b49dc0c9816"
    },
    {
      "path": "tests/production-participant-preanalysis-current-ci-lineage.test.mjs",
      "previousSha256": "568a07b2a88be7c9a0f217ce2b49fc61dbdeca8d6d1891dc63d0752f0efff9b4",
      "currentSha256": "ea91b9b98adffaf408f85d60982577ba4befe044fa3d0f1a34c0d1daa017c574"
    },
    {
      "path": "tests/production-pilot-whatsapp-current-lineage.test.mjs",
      "previousSha256": null,
      "currentSha256": "f2cd8e64186550c13ea7d6c1397735d20c932d03bd3fa7705a61b8d254b77372"
    },
    {
      "path": "tests/production-plan-budget-analyzer-http.test.mjs",
      "previousSha256": null,
      "currentSha256": "8f82a4764a84662acb6ea908476aae81247a70b46cb822abf1a89673cff91125"
    },
    {
      "path": "tests/production-plan-budget-source.test.mjs",
      "previousSha256": null,
      "currentSha256": "e6206d89ab2723827d2d642da7506a21409374e9e4e3b5971ee055808c84a1bc"
    },
    {
      "path": "tests/production-plan-budget-store.test.mjs",
      "previousSha256": null,
      "currentSha256": "f87d068344430bbdfc1adb21c93be5df6c7a72ab3c5d63c6c6fac59d92bf087b"
    },
    {
      "path": "tests/production-plan-budget-ui-contract.test.mjs",
      "previousSha256": null,
      "currentSha256": "11ca0baca1ab24ab1e25370fab6654dab0bbc975012126d6218fb5fafb209371"
    },
    {
      "path": "tests/production-plan-document-curve-ui.test.mjs",
      "previousSha256": "aea2b808c7d1648576813dcb4ffd73eb53942dc22b7cff35a98a81645fd6c0eb",
      "currentSha256": "da786706686ee622377094ffded125607d2ec4db3a7dbdc70212e5006cf30a4b"
    },
    {
      "path": "tests/production-plan-import-calendar-ui.test.mjs",
      "previousSha256": "9623993c9315115e712520e1b003bb347074de27d392eb5794f1fa14427c56f2",
      "currentSha256": "9eca05c38d8074297ea75be72f24e323e68103d292f4ed3d30ccc5afae679746"
    },
    {
      "path": "tests/production-plan-import-close-recovery-ui.test.mjs",
      "previousSha256": "a1968341ab5b43a8d0bf4a3ef8011b69d07d647a31d6b85ba6b2a0944448de77",
      "currentSha256": "f38560b719db87ff6f87f364e59b01b2bf533cca4ed4f79f6a1daef1719d2668"
    },
    {
      "path": "tests/production-plan-import-document-curve-fixture-copy.test.mjs",
      "previousSha256": "40953ff493ea8df1a28a4201bbb0903cff48240a1f8831d58ce7e05d3d08591d",
      "currentSha256": "fc4f5e58dff8b37f63ff4ca1b8c5c99c702530581ff77ad778a49322318765d4"
    },
    {
      "path": "tests/production-plan-import-link-ui.test.mjs",
      "previousSha256": "19a55f361e6ccf2db4460504664abd39141c835e80b04133385cd778bc210cad",
      "currentSha256": "f26804d2dd582a4d0949c037a468543f1b132efa3fffc9203d9cbc5972690496"
    },
    {
      "path": "tests/production-plan-measurement-ci.test.mjs",
      "previousSha256": "68fd8ecf6bc6351fc87a19db2c289688f306ed29b2c983c5da81e7ec3221aeab",
      "currentSha256": "49c3854c6edf7acb57b8929388d5dfc7b500825098e991eb63d4bb1a7a3a3e1f"
    },
    {
      "path": "tests/production-plan-measurement-current-ci-lineage.test.mjs",
      "previousSha256": "ead294a9a4066f487b58cb8e9187ca9fee03ad0c29706c2dfb6006cb23a82a81",
      "currentSha256": "19704b7e14b3405d0aa1348fd24ddeeae67cac5dc5a52d20bb6936ebf1e98816"
    },
    {
      "path": "tests/production-plan-measurement-document-association-ci-lineage.test.mjs",
      "previousSha256": "af5cd5fb58a541ef56c737dd947c16f608f585e18a6162796ca804054090e3e2",
      "currentSha256": "80fb2cec8442a2dfa47febb4d6ee736b4737a6435bde47c25a14dfa0b535be2d"
    },
    {
      "path": "tests/production-plan-source-curve-ui.test.mjs",
      "previousSha256": "30f9ecb970983cc4d9872feb7e89f301c1c6c899bda91055f7262dd2922bcb13",
      "currentSha256": "aa7fc15132d80cb9378cbcbf32312cf6aff20b95e7d2bb35cf96390657c3d0f0"
    },
    {
      "path": "tests/production-whatsapp-feedback-workspace-ci.test.mjs",
      "previousSha256": "6604b797f3466aad51028091fcddbcf3de1c86e9fec78b895c8156047d3f6c67",
      "currentSha256": "4cbba761beac4b8a5d72560a20c5395ba50bc5cbcfd68000de96e5c20022e342"
    },
    {
      "path": "tests/production-whatsapp-field-continuity-current-ci-lineage.test.mjs",
      "previousSha256": "43e1b60497a81d1598674fc3500b8ed47fa9be807c03788641ff5cf12c129521",
      "currentSha256": "a0e817f4f0ea3bae2a8042447a38ad099fb448a9ec8d34c0fd8e0b754685a497"
    },
    {
      "path": "tests/production-workspace-ci-consumer-projections.test.mjs",
      "previousSha256": "b63b67c71dce654db47fad94dcbe7e37563bd6ff5b019601f4d5b8c4dc6b8b10",
      "currentSha256": "d5caf324e0b729aa859a5771ac395ccd1e7a81ca078b36a076e91f70eb26c887"
    },
    {
      "path": "tests/production-workspace-continuity-current-ci-lineage.test.mjs",
      "previousSha256": "991b357dbba1a4c69060bad450c536a6314ab99948c9baff5da5405fd3511c6c",
      "currentSha256": "9764d78e78f38aafb242324d799b60b3c220e19d49cdf952b10b3b39e8a510cd"
    },
    {
      "path": "tests/production-workspace-plan-partida-budget-preview.test.mjs",
      "previousSha256": null,
      "currentSha256": "dab53818dbbf7c543c28ac5bc3a808bf69f9f96abe6e5f322cb5963b9253b4ce"
    },
    {
      "path": "tests/production-workspace-plan-partida-preview-current-ci-lineage.test.mjs",
      "previousSha256": "593466da00f03fff06c19e2ac746fb14fb03371f4ceb96a2f4fc342de6e3de32",
      "currentSha256": "2cbef1b11424a733a289f14759456ab87772fa4c2e5aebacbdce23c31d228042"
    }
  ],
  "sourceSetDeltas": [
    {
      "family": "UNIT",
      "contractPointer": "/extension/proofs/0/sourceFiles",
      "previousCount": 140,
      "previousPathsSha256": "7104df28ae9391e6038819dee38a1ee1c8b40806a229ed63324943da39ced460",
      "currentCount": 143,
      "currentPathsSha256": "0e39cffeba6361257d6a2b975934991f03d380007a3677aa3186846753f8beae",
      "additions": [
        "src/lib/meta-consumption-evidence-catalog.mjs",
        "src/lib/plan-budget-source.mjs",
        "src/lib/voice-consumption-draft.mjs"
      ]
    },
    {
      "family": "UI_BANK",
      "contractPointer": "/extension/proofs/3/sourceFiles",
      "previousCount": 144,
      "previousPathsSha256": "e581ca81d4ea63b3573d296b1fea9b318c738df99657657526f94317d8b9fed2",
      "currentCount": 147,
      "currentPathsSha256": "2912d51071f550d1547a051d19b13e696df01852196816bb11f13a779f729e69",
      "additions": [
        "src/lib/meta-consumption-evidence-catalog.mjs",
        "src/lib/plan-budget-source.mjs",
        "src/lib/voice-consumption-draft.mjs"
      ]
    },
    {
      "family": "UI_JOINT",
      "contractPointer": "/extension/proofs/5/sourceFiles",
      "previousCount": 143,
      "previousPathsSha256": "3c7e4b0e5ccbd4d8488e0ba0ad75ccbabe8b683670eed3482e096d7b33cc7e32",
      "currentCount": 146,
      "currentPathsSha256": "0487bd587cdf0c564d510064d506eb7093290338be1b6b343fadf770944111f1",
      "additions": [
        "src/lib/meta-consumption-evidence-catalog.mjs",
        "src/lib/plan-budget-source.mjs",
        "src/lib/voice-consumption-draft.mjs"
      ]
    },
    {
      "family": "UI_CAUSAL",
      "contractPointer": "/extension/proofs/6/sourceFiles",
      "previousCount": 143,
      "previousPathsSha256": "3c7e4b0e5ccbd4d8488e0ba0ad75ccbabe8b683670eed3482e096d7b33cc7e32",
      "currentCount": 146,
      "currentPathsSha256": "0487bd587cdf0c564d510064d506eb7093290338be1b6b343fadf770944111f1",
      "additions": [
        "src/lib/meta-consumption-evidence-catalog.mjs",
        "src/lib/plan-budget-source.mjs",
        "src/lib/voice-consumption-draft.mjs"
      ]
    },
    {
      "family": "PG_COMPANY_KYC",
      "contractPointer": "/extension/proofs/7/sourceFiles",
      "previousCount": 237,
      "previousPathsSha256": "649f11c2b82a4cfe38090cf6e1adcd1394a9cc719bf1c485bd3cd67a88f2c858",
      "currentCount": 240,
      "currentPathsSha256": "14f4750b50f68ffd496eacaffcd410544acf576d7c3b00b7a90a621544180113",
      "additions": [
        "src/lib/meta-consumption-evidence-catalog.mjs",
        "src/lib/plan-budget-source.mjs",
        "src/lib/voice-consumption-draft.mjs"
      ]
    },
    {
      "family": "UI_IDENTITY_ONLY",
      "contractPointer": "/extension/proofs/13/sourceFiles",
      "previousCount": 161,
      "previousPathsSha256": "8e0a4daa7b9829e96f8a984a846235038a541e2e0fbfe599d0a8b592222bb1c6",
      "currentCount": 163,
      "currentPathsSha256": "a086e210d1c155270a6ac40f481b150a0ca19ba1de2b42b097532badda3579c8",
      "additions": [
        "src/app/(identity)/cuenta/plan-partida-budget-preview.js",
        "src/app/(identity)/cuenta/plan-partida-budget-preview.mjs"
      ]
    },
    {
      "family": "PG_FIELD",
      "contractPointer": "/extension/proofs/14/sourceFiles",
      "previousCount": 129,
      "previousPathsSha256": "32b4daffe18d479b78a644499d16034dc3f85442e5e84e4f7a2cc05c8b399c69",
      "currentCount": 133,
      "currentPathsSha256": "862157348d275beb0b84b2b4e4c7ab35cd644a560dff85594706ed98bd9aa571",
      "additions": [
        "src/lib/meta-consumption-evidence-catalog.mjs",
        "src/lib/plan-budget-source.mjs",
        "src/lib/voice-consumption-draft.mjs",
        "tests/production-field-attendance-review-query.test.mjs"
      ]
    },
    {
      "family": "PG_OVERTIME",
      "contractPointer": "/extension/proofs/15/sourceFiles",
      "previousCount": 114,
      "previousPathsSha256": "19f1a9094ddee24870d3f3e2cd963b34fd85def12472e797cabef3af9aac64b5",
      "currentCount": 117,
      "currentPathsSha256": "380e16df944c2abb17f4980b6d1a8ea61ec6323c52a5d35133b7b503724fe340",
      "additions": [
        "src/lib/meta-consumption-evidence-catalog.mjs",
        "src/lib/plan-budget-source.mjs",
        "src/lib/voice-consumption-draft.mjs"
      ]
    },
    {
      "family": "PG_PLAN_BASELINE",
      "contractPointer": "/extension/proofs/16/sourceFiles",
      "previousCount": 35,
      "previousPathsSha256": "63b942d2eda55e280f5989cd0147dc9aff12e7f9cac3ac3592ea67071c0e95ea",
      "currentCount": 36,
      "currentPathsSha256": "9015ed97b3ac0efdaddca162d0ba7f20beec9f5330a8968732d61518f5c982e7",
      "additions": [
        "src/lib/plan-budget-source.mjs"
      ]
    },
    {
      "family": "UI_DOCUMENT_CURVE",
      "contractPointer": "/extension/proofs/17/sourceFiles",
      "previousCount": 41,
      "previousPathsSha256": "1522cefb0897fd89cc0482fff34ebab41492c16e187b57e50801496bd898a44d",
      "currentCount": 44,
      "currentPathsSha256": "827c538bd2a4b74074a547f98a183f1c6fe9f538800dc9be35fc8b77ce73fb85",
      "additions": [
        "src/app/(identity)/cuenta/plan-partida-budget-preview.js",
        "src/app/(identity)/cuenta/plan-partida-budget-preview.mjs",
        "src/lib/plan-budget-source.mjs"
      ]
    },
    {
      "family": "PG_PARTICIPANT_KYC_PREANALYSIS",
      "contractPointer": "/extension/proofs/18/sourceFiles",
      "previousCount": 243,
      "previousPathsSha256": "404123db2d7b89f77f508aa9840a93803b878dfc9a9df5dbd9805d5f1426f1b9",
      "currentCount": 248,
      "currentPathsSha256": "a7ad4093d60af7472d3e539c951f19e92c5548a87b2541bbbca28c25867f7a0f",
      "additions": [
        "scripts/lib/plan-budget-current-ci-lineage.mjs",
        "scripts/lib/plan-budget-current-ci-reviewed.mjs",
        "src/lib/meta-consumption-evidence-catalog.mjs",
        "src/lib/plan-budget-source.mjs",
        "src/lib/voice-consumption-draft.mjs"
      ]
    },
    {
      "family": "UI_FOCUSED_WORKSPACE",
      "contractPointer": "/extension/proofs/19/sourceFiles",
      "previousCount": 199,
      "previousPathsSha256": "a8c90fd0e156e464f44cd5657d008e8e15b29fb4812d8b47a13f994235a22b8f",
      "currentCount": 203,
      "currentPathsSha256": "d588ea0f81285e32c609fd180ad9dacc7b48a65e22a52493eeb0c8d6e3c0355e",
      "additions": [
        "scripts/lib/plan-budget-current-ci-lineage.mjs",
        "scripts/lib/plan-budget-current-ci-reviewed.mjs",
        "src/app/(identity)/cuenta/plan-partida-budget-preview.js",
        "src/app/(identity)/cuenta/plan-partida-budget-preview.mjs"
      ]
    },
    {
      "family": "UI_FIELD_TASK_PAGINATION",
      "contractPointer": "/extension/proofs/20/sourceFiles",
      "previousCount": 75,
      "previousPathsSha256": "5624848f060138e2071b22e4bb606a9c5b726ab0c02cde39dc1fd8e0a1627895",
      "currentCount": 77,
      "currentPathsSha256": "419dfb46946cd37f2c5b6d1bc2f4e12c1cc29fbf7c8efd54cdde8cff7d822bb2",
      "additions": [
        "scripts/lib/plan-budget-current-ci-lineage.mjs",
        "scripts/lib/plan-budget-current-ci-reviewed.mjs"
      ]
    },
    {
      "family": "LIVE_HOURS_RUNTIME",
      "contractPointer": null,
      "previousCount": 169,
      "previousPathsSha256": "f6391decdcdcb680c3bd8bd220493e224e4fc1aea4ad53188f54b07216f711ad",
      "currentCount": 171,
      "currentPathsSha256": "11242316db77b273f3a59a4b444092d626a2d552a48c4e97a1ae32e8930fd176",
      "additions": [
        "src/app/(identity)/cuenta/plan-partida-budget-preview.js",
        "src/app/(identity)/cuenta/plan-partida-budget-preview.mjs"
      ]
    },
    {
      "family": "PLAN_MEASUREMENT",
      "contractPointer": null,
      "previousCount": 119,
      "previousPathsSha256": "bbd40a42f7adf860f4121321c30b21275832459282836839c363950bd6848596",
      "currentCount": 122,
      "currentPathsSha256": "49d4c2c3d58e45e81a15fe7b86a3792cf11c1e4e35b41bcc02b91a67ce6e25bd",
      "additions": [
        "src/lib/meta-consumption-evidence-catalog.mjs",
        "src/lib/plan-budget-source.mjs",
        "src/lib/voice-consumption-draft.mjs"
      ]
    },
    {
      "family": "MEASUREMENT_UI_RUNTIME",
      "contractPointer": null,
      "previousCount": 17,
      "previousPathsSha256": "01f7fa11809ac25078bd09759bf50b30cd1f0e465d69919432aeddf6b7f6a756",
      "currentCount": 18,
      "currentPathsSha256": "f51479c386a092cdf4d4df7661aae35444016f793e11b3d8bba36935adad887a",
      "additions": [
        "src/lib/plan-budget-source.mjs"
      ]
    },
    {
      "family": "CONSUMPTION_FEEDBACK",
      "contractPointer": null,
      "previousCount": 116,
      "previousPathsSha256": "dd3c6b65b19b524342384c789468e113ccbacf527365ecee69bd45186f2bbc92",
      "currentCount": 119,
      "currentPathsSha256": "72a82cddb5d98cd8fbb4c73180be02f5a0da1804b223bbdff5723154e2416d07",
      "additions": [
        "src/lib/meta-consumption-evidence-catalog.mjs",
        "src/lib/plan-budget-source.mjs",
        "src/lib/voice-consumption-draft.mjs"
      ]
    },
    {
      "family": "CONSUMPTION_FEEDBACK_UI",
      "contractPointer": null,
      "previousCount": 26,
      "previousPathsSha256": "710e01893f5a62e3889bdaddca949989edac48b312c75ea419ea822b744c864a",
      "currentCount": 28,
      "currentPathsSha256": "ac29e18d380c5706e620702b48fd9510f5d358bc857a5cb4a08d0c49561de16e",
      "additions": [
        "src/app/(identity)/cuenta/field-media-preview.js",
        "src/app/(identity)/cuenta/field-operations-panel.module.css"
      ]
    },
    {
      "family": "COMPACT",
      "contractPointer": null,
      "previousCount": 140,
      "previousPathsSha256": "95302675847ab612d6b3a9d5139991fce835d122e665c71373fa23be46c6435a",
      "currentCount": 143,
      "currentPathsSha256": "0a9dad18de039f23ec0803c52491bb034a48b7ccde6121fb220e55fba88580ae",
      "additions": [
        "src/lib/meta-consumption-evidence-catalog.mjs",
        "src/lib/plan-budget-source.mjs",
        "src/lib/voice-consumption-draft.mjs"
      ]
    },
    {
      "family": "ORGANIZATION_USAGE",
      "contractPointer": null,
      "previousCount": 121,
      "previousPathsSha256": "61c6ff93f2afbcd4d561e3e635927c240ac09100ee79616901ddbd24fb60010b",
      "currentCount": 124,
      "currentPathsSha256": "d9c5c648aad1d3ca3eb3d7a19fac70428d0d9ad4817415a07f3306f76578bae8",
      "additions": [
        "src/lib/meta-consumption-evidence-catalog.mjs",
        "src/lib/plan-budget-source.mjs",
        "src/lib/voice-consumption-draft.mjs"
      ]
    },
    {
      "family": "KYC_REPLY_FEEDBACK",
      "contractPointer": null,
      "previousCount": 117,
      "previousPathsSha256": "c065cec9a54b9acb73f0cd9b84517326f9686222f7609c0401ad4b7b6bbb6f7c",
      "currentCount": 120,
      "currentPathsSha256": "d25e427d84aa9d85d9c25318e52fd57f9cc4f8dfaa2efadfee5a24f5b96b4882",
      "additions": [
        "src/lib/meta-consumption-evidence-catalog.mjs",
        "src/lib/plan-budget-source.mjs",
        "src/lib/voice-consumption-draft.mjs"
      ]
    },
    {
      "family": "ORGANIZATION_USAGE_UI",
      "contractPointer": null,
      "previousCount": 32,
      "previousPathsSha256": "a4e57eaf7735e71a357a95cefd5e87fb554199f7d190b85057a8f415ef8f3b08",
      "currentCount": 34,
      "currentPathsSha256": "c8b6035754c7f0ebe9514d7824b1b26914694c80beeb2bc891bdc36db6dddaea",
      "additions": [
        "src/app/(identity)/cuenta/plan-partida-budget-preview.js",
        "src/app/(identity)/cuenta/plan-partida-budget-preview.mjs"
      ]
    }
  ],
  "sourceFamilies": [
    {
      "family": "LIVE_HOURS_RUNTIME",
      "previousFiles": [
        "src/app/(identity)/cuenta/company-bootstrap-panel.js",
        "src/app/(identity)/cuenta/company-bootstrap-panel.module.css",
        "src/app/(identity)/cuenta/company-channel-panel.js",
        "src/app/(identity)/cuenta/company-channel-panel.module.css",
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/company-subscription-panel.js",
        "src/app/(identity)/cuenta/company-subscription-panel.module.css",
        "src/app/(identity)/cuenta/company-subscription-view.mjs",
        "src/app/(identity)/cuenta/company-usage-panel.js",
        "src/app/(identity)/cuenta/company-usage-view.mjs",
        "src/app/(identity)/cuenta/constructor-crm-panel.js",
        "src/app/(identity)/cuenta/constructor-crm-panel.module.css",
        "src/app/(identity)/cuenta/constructor-crm-view.mjs",
        "src/app/(identity)/cuenta/customer-inbox-panel.js",
        "src/app/(identity)/cuenta/customer-inbox-panel.module.css",
        "src/app/(identity)/cuenta/customer-inbox-view.mjs",
        "src/app/(identity)/cuenta/customer-whatsapp-panel.js",
        "src/app/(identity)/cuenta/customer-whatsapp-panel.module.css",
        "src/app/(identity)/cuenta/customer-whatsapp-view.mjs",
        "src/app/(identity)/cuenta/demo-pilot-panel.js",
        "src/app/(identity)/cuenta/demo-pilot-view.mjs",
        "src/app/(identity)/cuenta/employee-intake-continuity.mjs",
        "src/app/(identity)/cuenta/employee-intake-panel.js",
        "src/app/(identity)/cuenta/field-hours-report-panel.js",
        "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
        "src/app/(identity)/cuenta/field-media-capture.js",
        "src/app/(identity)/cuenta/field-media-held-view.mjs",
        "src/app/(identity)/cuenta/field-media-preparation.mjs",
        "src/app/(identity)/cuenta/field-media-preview.js",
        "src/app/(identity)/cuenta/field-operations-panel.js",
        "src/app/(identity)/cuenta/field-operations-panel.module.css",
        "src/app/(identity)/cuenta/field-overtime-view.js",
        "src/app/(identity)/cuenta/field-overtime-view.module.css",
        "src/app/(identity)/cuenta/field-qr-capture.js",
        "src/app/(identity)/cuenta/field-qr-reader.mjs",
        "src/app/(identity)/cuenta/field-review-page-view.mjs",
        "src/app/(identity)/cuenta/kyc-photo-preparation.js",
        "src/app/(identity)/cuenta/material-inventory-panel.js",
        "src/app/(identity)/cuenta/material-inventory-panel.module.css",
        "src/app/(identity)/cuenta/material-inventory-view.mjs",
        "src/app/(identity)/cuenta/meta-existing-api-plan-view.mjs",
        "src/app/(identity)/cuenta/meta-onboarding-panel.js",
        "src/app/(identity)/cuenta/meta-onboarding-panel.module.css",
        "src/app/(identity)/cuenta/meta-onboarding-readiness-view.mjs",
        "src/app/(identity)/cuenta/meta-sdk-loader.mjs",
        "src/app/(identity)/cuenta/office-review-panel.js",
        "src/app/(identity)/cuenta/office-review-panel.module.css",
        "src/app/(identity)/cuenta/office-review-view.mjs",
        "src/app/(identity)/cuenta/operations-status-panel.js",
        "src/app/(identity)/cuenta/operations-status-panel.module.css",
        "src/app/(identity)/cuenta/own-company-number-panel.js",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-panel.js",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-account-discovery-format.mjs",
        "src/app/(identity)/cuenta/participant-account-discovery.js",
        "src/app/(identity)/cuenta/participant-civil-data-panel.js",
        "src/app/(identity)/cuenta/participant-civil-data-view.mjs",
        "src/app/(identity)/cuenta/participant-kyc-capture.js",
        "src/app/(identity)/cuenta/participant-kyc-capture.module.css",
        "src/app/(identity)/cuenta/participant-kyc-chat-attempt-panel.js",
        "src/app/(identity)/cuenta/participant-kyc-chat-attempt-view.mjs",
        "src/app/(identity)/cuenta/participant-kyc-preanalysis-view.mjs",
        "src/app/(identity)/cuenta/participant-ocr-usage-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/participant-onboarding-next-step.mjs",
        "src/app/(identity)/cuenta/participant-panel.js",
        "src/app/(identity)/cuenta/participant-panel.module.css",
        "src/app/(identity)/cuenta/plan-baseline-panel.js",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline.module.css",
        "src/app/(identity)/cuenta/plan-import-calendar-suggestions.mjs",
        "src/app/(identity)/cuenta/plan-import-panel.js",
        "src/app/(identity)/cuenta/plan-import-panel.module.css",
        "src/app/(identity)/cuenta/plan-import-usage-view.mjs",
        "src/app/(identity)/cuenta/plan-measurement-panel.js",
        "src/app/(identity)/cuenta/plan-measurement-panel.module.css",
        "src/app/(identity)/cuenta/plan-measurement-view.mjs",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.js",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.js",
        "src/app/(identity)/cuenta/plan-partida-source-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.module.css",
        "src/app/(identity)/cuenta/plan-source-curve.js",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.module.css",
        "src/app/(identity)/cuenta/portfolio-overview-panel.js",
        "src/app/(identity)/cuenta/portfolio-overview-panel.module.css",
        "src/app/(identity)/cuenta/portfolio-overview-view.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/private-bank-account-panel.js",
        "src/app/(identity)/cuenta/private-bank-account-panel.module.css",
        "src/app/(identity)/cuenta/private-workspace-download.js",
        "src/app/(identity)/cuenta/project-creation-format.mjs",
        "src/app/(identity)/cuenta/project-creation-panel.js",
        "src/app/(identity)/cuenta/project-creation-panel.module.css",
        "src/app/(identity)/cuenta/project-preparation-format.mjs",
        "src/app/(identity)/cuenta/project-preparation-panel.js",
        "src/app/(identity)/cuenta/project-preparation-panel.module.css",
        "src/app/(identity)/cuenta/schedule-workbench.js",
        "src/app/(identity)/cuenta/schedule-workbench.mjs",
        "src/app/(identity)/cuenta/schedule-workbench.module.css",
        "src/app/(identity)/cuenta/site-purchase-panel.js",
        "src/app/(identity)/cuenta/site-purchase-panel.module.css",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/site-register-panel.js",
        "src/app/(identity)/cuenta/site-register-panel.module.css",
        "src/app/(identity)/cuenta/task-create-panel.js",
        "src/app/(identity)/cuenta/task-progress-measurement-editor.js",
        "src/app/(identity)/cuenta/task-progress-measurement-editor.module.css",
        "src/app/(identity)/cuenta/task-progress-measurement-view.mjs",
        "src/app/(identity)/cuenta/template-send-panel.js",
        "src/app/(identity)/cuenta/template-send-panel.module.css",
        "src/app/(identity)/cuenta/template-send-view.mjs",
        "src/app/(identity)/cuenta/voice-progress-draft-view.js",
        "src/app/(identity)/cuenta/worker-channel-panel.js",
        "src/app/(identity)/cuenta/worker-channel-panel.module.css",
        "src/app/(identity)/cuenta/worksite-task-selector.js",
        "src/app/(identity)/cuenta/worksite-task-selector.module.css",
        "src/app/(identity)/cuenta/workspace-client.js",
        "src/app/(identity)/cuenta/workspace-live-read.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh.js",
        "src/app/(identity)/cuenta/workspace-overview.js",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-panel.js",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-screen.js",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/app/(identity)/cuenta/workspace-task-page.mjs",
        "src/app/(identity)/cuenta/workspace-tools-navigation.js",
        "src/app/(identity)/cuenta/workspace-tools-navigation.module.css",
        "src/app/(identity)/cuenta/workspace-view-routing.mjs",
        "src/app/(identity)/cuenta/workspace.module.css",
        "src/lib/company-entitlement.mjs",
        "src/lib/company-phone-format.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-http.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/identity-return-path.mjs",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/whatsapp/tenant-workspace-policy.js",
        "src/lib/workspace-http.mjs",
        "src/lib/workspace-policy.mjs"
      ],
      "previousExternalImports": [
        "ffmpeg-static",
        "jsqr",
        "lucide-react",
        "next/navigation",
        "node:child_process",
        "node:crypto",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "react"
      ],
      "currentFiles": [
        "src/app/(identity)/cuenta/company-bootstrap-panel.js",
        "src/app/(identity)/cuenta/company-bootstrap-panel.module.css",
        "src/app/(identity)/cuenta/company-channel-panel.js",
        "src/app/(identity)/cuenta/company-channel-panel.module.css",
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/company-subscription-panel.js",
        "src/app/(identity)/cuenta/company-subscription-panel.module.css",
        "src/app/(identity)/cuenta/company-subscription-view.mjs",
        "src/app/(identity)/cuenta/company-usage-panel.js",
        "src/app/(identity)/cuenta/company-usage-view.mjs",
        "src/app/(identity)/cuenta/constructor-crm-panel.js",
        "src/app/(identity)/cuenta/constructor-crm-panel.module.css",
        "src/app/(identity)/cuenta/constructor-crm-view.mjs",
        "src/app/(identity)/cuenta/customer-inbox-panel.js",
        "src/app/(identity)/cuenta/customer-inbox-panel.module.css",
        "src/app/(identity)/cuenta/customer-inbox-view.mjs",
        "src/app/(identity)/cuenta/customer-whatsapp-panel.js",
        "src/app/(identity)/cuenta/customer-whatsapp-panel.module.css",
        "src/app/(identity)/cuenta/customer-whatsapp-view.mjs",
        "src/app/(identity)/cuenta/demo-pilot-panel.js",
        "src/app/(identity)/cuenta/demo-pilot-view.mjs",
        "src/app/(identity)/cuenta/employee-intake-continuity.mjs",
        "src/app/(identity)/cuenta/employee-intake-panel.js",
        "src/app/(identity)/cuenta/field-hours-report-panel.js",
        "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
        "src/app/(identity)/cuenta/field-media-capture.js",
        "src/app/(identity)/cuenta/field-media-held-view.mjs",
        "src/app/(identity)/cuenta/field-media-preparation.mjs",
        "src/app/(identity)/cuenta/field-media-preview.js",
        "src/app/(identity)/cuenta/field-operations-panel.js",
        "src/app/(identity)/cuenta/field-operations-panel.module.css",
        "src/app/(identity)/cuenta/field-overtime-view.js",
        "src/app/(identity)/cuenta/field-overtime-view.module.css",
        "src/app/(identity)/cuenta/field-qr-capture.js",
        "src/app/(identity)/cuenta/field-qr-reader.mjs",
        "src/app/(identity)/cuenta/field-review-page-view.mjs",
        "src/app/(identity)/cuenta/kyc-photo-preparation.js",
        "src/app/(identity)/cuenta/material-inventory-panel.js",
        "src/app/(identity)/cuenta/material-inventory-panel.module.css",
        "src/app/(identity)/cuenta/material-inventory-view.mjs",
        "src/app/(identity)/cuenta/meta-existing-api-plan-view.mjs",
        "src/app/(identity)/cuenta/meta-onboarding-panel.js",
        "src/app/(identity)/cuenta/meta-onboarding-panel.module.css",
        "src/app/(identity)/cuenta/meta-onboarding-readiness-view.mjs",
        "src/app/(identity)/cuenta/meta-sdk-loader.mjs",
        "src/app/(identity)/cuenta/office-review-panel.js",
        "src/app/(identity)/cuenta/office-review-panel.module.css",
        "src/app/(identity)/cuenta/office-review-view.mjs",
        "src/app/(identity)/cuenta/operations-status-panel.js",
        "src/app/(identity)/cuenta/operations-status-panel.module.css",
        "src/app/(identity)/cuenta/own-company-number-panel.js",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-panel.js",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-account-discovery-format.mjs",
        "src/app/(identity)/cuenta/participant-account-discovery.js",
        "src/app/(identity)/cuenta/participant-civil-data-panel.js",
        "src/app/(identity)/cuenta/participant-civil-data-view.mjs",
        "src/app/(identity)/cuenta/participant-kyc-capture.js",
        "src/app/(identity)/cuenta/participant-kyc-capture.module.css",
        "src/app/(identity)/cuenta/participant-kyc-chat-attempt-panel.js",
        "src/app/(identity)/cuenta/participant-kyc-chat-attempt-view.mjs",
        "src/app/(identity)/cuenta/participant-kyc-preanalysis-view.mjs",
        "src/app/(identity)/cuenta/participant-ocr-usage-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/participant-onboarding-next-step.mjs",
        "src/app/(identity)/cuenta/participant-panel.js",
        "src/app/(identity)/cuenta/participant-panel.module.css",
        "src/app/(identity)/cuenta/plan-baseline-panel.js",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline.module.css",
        "src/app/(identity)/cuenta/plan-import-calendar-suggestions.mjs",
        "src/app/(identity)/cuenta/plan-import-panel.js",
        "src/app/(identity)/cuenta/plan-import-panel.module.css",
        "src/app/(identity)/cuenta/plan-import-usage-view.mjs",
        "src/app/(identity)/cuenta/plan-measurement-panel.js",
        "src/app/(identity)/cuenta/plan-measurement-panel.module.css",
        "src/app/(identity)/cuenta/plan-measurement-view.mjs",
        "src/app/(identity)/cuenta/plan-partida-budget-preview.js",
        "src/app/(identity)/cuenta/plan-partida-budget-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.js",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.js",
        "src/app/(identity)/cuenta/plan-partida-source-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.module.css",
        "src/app/(identity)/cuenta/plan-source-curve.js",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.module.css",
        "src/app/(identity)/cuenta/portfolio-overview-panel.js",
        "src/app/(identity)/cuenta/portfolio-overview-panel.module.css",
        "src/app/(identity)/cuenta/portfolio-overview-view.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/private-bank-account-panel.js",
        "src/app/(identity)/cuenta/private-bank-account-panel.module.css",
        "src/app/(identity)/cuenta/private-workspace-download.js",
        "src/app/(identity)/cuenta/project-creation-format.mjs",
        "src/app/(identity)/cuenta/project-creation-panel.js",
        "src/app/(identity)/cuenta/project-creation-panel.module.css",
        "src/app/(identity)/cuenta/project-preparation-format.mjs",
        "src/app/(identity)/cuenta/project-preparation-panel.js",
        "src/app/(identity)/cuenta/project-preparation-panel.module.css",
        "src/app/(identity)/cuenta/schedule-workbench.js",
        "src/app/(identity)/cuenta/schedule-workbench.mjs",
        "src/app/(identity)/cuenta/schedule-workbench.module.css",
        "src/app/(identity)/cuenta/site-purchase-panel.js",
        "src/app/(identity)/cuenta/site-purchase-panel.module.css",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/site-register-panel.js",
        "src/app/(identity)/cuenta/site-register-panel.module.css",
        "src/app/(identity)/cuenta/task-create-panel.js",
        "src/app/(identity)/cuenta/task-progress-measurement-editor.js",
        "src/app/(identity)/cuenta/task-progress-measurement-editor.module.css",
        "src/app/(identity)/cuenta/task-progress-measurement-view.mjs",
        "src/app/(identity)/cuenta/template-send-panel.js",
        "src/app/(identity)/cuenta/template-send-panel.module.css",
        "src/app/(identity)/cuenta/template-send-view.mjs",
        "src/app/(identity)/cuenta/voice-progress-draft-view.js",
        "src/app/(identity)/cuenta/worker-channel-panel.js",
        "src/app/(identity)/cuenta/worker-channel-panel.module.css",
        "src/app/(identity)/cuenta/worksite-task-selector.js",
        "src/app/(identity)/cuenta/worksite-task-selector.module.css",
        "src/app/(identity)/cuenta/workspace-client.js",
        "src/app/(identity)/cuenta/workspace-live-read.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh.js",
        "src/app/(identity)/cuenta/workspace-overview.js",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-panel.js",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-screen.js",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/app/(identity)/cuenta/workspace-task-page.mjs",
        "src/app/(identity)/cuenta/workspace-tools-navigation.js",
        "src/app/(identity)/cuenta/workspace-tools-navigation.module.css",
        "src/app/(identity)/cuenta/workspace-view-routing.mjs",
        "src/app/(identity)/cuenta/workspace.module.css",
        "src/lib/company-entitlement.mjs",
        "src/lib/company-phone-format.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-http.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/identity-return-path.mjs",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/whatsapp/tenant-workspace-policy.js",
        "src/lib/workspace-http.mjs",
        "src/lib/workspace-policy.mjs"
      ],
      "externalImports": [
        "ffmpeg-static",
        "jsqr",
        "lucide-react",
        "next/navigation",
        "node:child_process",
        "node:crypto",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "react"
      ],
      "currentManifest": [
        {
          "path": "src/app/(identity)/cuenta/company-bootstrap-panel.js",
          "sha256": "f8fabe5917469d3303328ebdfc447fc4c6f3bd2e1f407abbd97c4ba7b8e713d3"
        },
        {
          "path": "src/app/(identity)/cuenta/company-bootstrap-panel.module.css",
          "sha256": "a8cadc4631ef54a18578344d93b8bed8568fbd847abce0cd02c57b2e7969dcdf"
        },
        {
          "path": "src/app/(identity)/cuenta/company-channel-panel.js",
          "sha256": "b41b9fd9a0fa16a25914b8d074ffbac1588b5d26dcca0310a8626ee211154a24"
        },
        {
          "path": "src/app/(identity)/cuenta/company-channel-panel.module.css",
          "sha256": "365d5f5884c39e239e0e0bf2ce5da2d37791a2d2ce5ce2e3c5d3021cc96db66e"
        },
        {
          "path": "src/app/(identity)/cuenta/company-channel-view.mjs",
          "sha256": "c79c473999e444b84e2a1d58e0d03f030069c24f9749f2c84450318b0b237e4d"
        },
        {
          "path": "src/app/(identity)/cuenta/company-subscription-panel.js",
          "sha256": "0b208fdcbea4900bd6adf86ad80f8524b5afa647d78a24fbf5731d3d7d79c749"
        },
        {
          "path": "src/app/(identity)/cuenta/company-subscription-panel.module.css",
          "sha256": "fdede43a09f48b011f7e3cb184ea16bf0be0e98069e7a953b71b8e391b3dfa3e"
        },
        {
          "path": "src/app/(identity)/cuenta/company-subscription-view.mjs",
          "sha256": "d009632c97d18084a1907bd7dedcf140f1a5d4ee0b55dd95f33d83be152dfc9c"
        },
        {
          "path": "src/app/(identity)/cuenta/company-usage-panel.js",
          "sha256": "01beddb3b88861bda1549169cc885bc682bd5446e4289521e5a36a6386ac37aa"
        },
        {
          "path": "src/app/(identity)/cuenta/company-usage-view.mjs",
          "sha256": "27cb4b607405186f57d70ffa7d78b1b2f9456486a4bfeb40b0157c9c52a2dc29"
        },
        {
          "path": "src/app/(identity)/cuenta/constructor-crm-panel.js",
          "sha256": "9447f5d87002193e34b99c1276a958b0e00539a901e372ce4e16584358d54554"
        },
        {
          "path": "src/app/(identity)/cuenta/constructor-crm-panel.module.css",
          "sha256": "8d99b34339e2f4d434cda5abbd9a1bf11c13d1335cb407fcfad6629810d98bf4"
        },
        {
          "path": "src/app/(identity)/cuenta/constructor-crm-view.mjs",
          "sha256": "9e0520a9f15c86d9b79b85bad2067b4dcdba3c82b1d3e6b32b86f811f79bf885"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-inbox-panel.js",
          "sha256": "a933afae1cecb3e523d37904ee6f9543c958b738f6abbb4eb013cf12c1535909"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-inbox-panel.module.css",
          "sha256": "abfcade899997a72ad9789020d8223257cc35128657cae6a74df386dc22381f3"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-inbox-view.mjs",
          "sha256": "c38e1d18d59fa2be870fc90cdd748dcb3d3b24e805aa5924f4a79ae5733a001f"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-whatsapp-panel.js",
          "sha256": "d129c4aa22e8048e03674382828222e5141e219f5d12368139a75ae735c9b247"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-whatsapp-panel.module.css",
          "sha256": "00e35b2fcea0140d639c6207ae7c33476e8075c297ffec1aebebefaae3ccc136"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-whatsapp-view.mjs",
          "sha256": "baae13c4e846d6e9787a58dc9ca83ee45e3a79cafd87d104dc68c16da4b31437"
        },
        {
          "path": "src/app/(identity)/cuenta/demo-pilot-panel.js",
          "sha256": "f2d9b7bfaf481c4ca1f8b9b2120bfe688375f745508c249cf04112178dab9270"
        },
        {
          "path": "src/app/(identity)/cuenta/demo-pilot-view.mjs",
          "sha256": "8816f95d81094b0a44c8e1dec5b94b4886ee493e4dd8caaec0d9eb95adbdbf01"
        },
        {
          "path": "src/app/(identity)/cuenta/employee-intake-continuity.mjs",
          "sha256": "11ca9957e2d04545485617e2cefa939673e2ad5b3e45943b5c9ba24b28f5b8ee"
        },
        {
          "path": "src/app/(identity)/cuenta/employee-intake-panel.js",
          "sha256": "111fc1e7918fe28d2e9aa9f1dd3abc63c7d18c45e8dc6d328d1b0b3c64361b46"
        },
        {
          "path": "src/app/(identity)/cuenta/field-hours-report-panel.js",
          "sha256": "d91074b8b1693c95dcf80a86fc73711fbd98a7ba482251ade68fd227166fb748"
        },
        {
          "path": "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
          "sha256": "0c8eefb85891cade983a42b7f4463962319c9fe27c0c5d157011108255c2bd75"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-capture.js",
          "sha256": "f8019225870bc6ccf04818ad7ff305798d53ea9b523400385816ba7fe2117559"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-held-view.mjs",
          "sha256": "cfc01204f973281e77a49627c7c5e32c6bdd04a1bc4c6e0a9e93773eca4faf71"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-preparation.mjs",
          "sha256": "df03121d9a7beb6b4a77946cefb09ce00710a6e22b5c8b680b180dd5a2e64a6f"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-preview.js",
          "sha256": "61506157217af690aa3ea649a2472f99acc24ec96aa10eda3cc25d24a8108441"
        },
        {
          "path": "src/app/(identity)/cuenta/field-operations-panel.js",
          "sha256": "5477d459da2e68688ce3bcf68f8f928ab0a4155144696abb2736f0c511fcd455"
        },
        {
          "path": "src/app/(identity)/cuenta/field-operations-panel.module.css",
          "sha256": "5ccd8b5beae691b9ab6ee2dc0c0ae876a5fdffe15d31d24c6807f117bd76949c"
        },
        {
          "path": "src/app/(identity)/cuenta/field-overtime-view.js",
          "sha256": "161a09cb92b09695c4007cf99c3c7755586bf8e05d7f93e147fe9f1bfb45ca60"
        },
        {
          "path": "src/app/(identity)/cuenta/field-overtime-view.module.css",
          "sha256": "e7f9e4ff4216fdb18b333d0b8cd40a5b3158e5f2e398f6207ab5cea2789fcf7a"
        },
        {
          "path": "src/app/(identity)/cuenta/field-qr-capture.js",
          "sha256": "3bc42cb87ec6554a9ac6001b199f434f087e4156139d76428d1ebaf43d12e37d"
        },
        {
          "path": "src/app/(identity)/cuenta/field-qr-reader.mjs",
          "sha256": "04157b9fc7a197271bac76d41217db8876b42dc6fbc6cb068a7052d2ea2b5b31"
        },
        {
          "path": "src/app/(identity)/cuenta/field-review-page-view.mjs",
          "sha256": "a1187150e0a3344666418b0191a898a6cf019ad2e8e5c46be2be721aee969634"
        },
        {
          "path": "src/app/(identity)/cuenta/kyc-photo-preparation.js",
          "sha256": "88137686826cc411d6fcc103b0085390c0cc16f69572cf45c2385bcde69f943d"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-panel.js",
          "sha256": "f910384fa3acc4326037b4a4b0c141c1712cb95845f14d8d975705463fecd2e2"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-panel.module.css",
          "sha256": "1d7eec4afc275ee403674b187acb7844e3df519f24cd537af2e05f7b8032611c"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-view.mjs",
          "sha256": "8942cb9a2f3ed071a77a9e87ca3876fa16b1f819bcb74f395e4307f7c167605a"
        },
        {
          "path": "src/app/(identity)/cuenta/meta-existing-api-plan-view.mjs",
          "sha256": "c44cbf28f4642b7c60109668d60354acc298439653e34fd13aa6610e5e9e5588"
        },
        {
          "path": "src/app/(identity)/cuenta/meta-onboarding-panel.js",
          "sha256": "314f7b6b6e160a4c58f9f373ff6970d049ad4feefea7501a5d29ad4d63613af8"
        },
        {
          "path": "src/app/(identity)/cuenta/meta-onboarding-panel.module.css",
          "sha256": "47ddd495c465ce9c9c4d75df19c722fb35f3e9873396f95d948f43031efe760b"
        },
        {
          "path": "src/app/(identity)/cuenta/meta-onboarding-readiness-view.mjs",
          "sha256": "78d15f464576d77c5a676a8c9a682dea4a3f43113fdaa898237b75478ec5132c"
        },
        {
          "path": "src/app/(identity)/cuenta/meta-sdk-loader.mjs",
          "sha256": "3a2dcc3d99a29e7b1adffb833ae206e14990d18cc32025b4a31b21728a7c4d88"
        },
        {
          "path": "src/app/(identity)/cuenta/office-review-panel.js",
          "sha256": "6743f03b2a01fcb80f1b63069717fff0daa68e9c76bc97eed90fc7c270622ce1"
        },
        {
          "path": "src/app/(identity)/cuenta/office-review-panel.module.css",
          "sha256": "4e1ca532b4cf582d13dbd9a3de1b54f1c2ae97b360a69a5df628ad34780d9725"
        },
        {
          "path": "src/app/(identity)/cuenta/office-review-view.mjs",
          "sha256": "84762ddace81533b1684f23f9abafe8a06a3847fdd01fbbf67c84014c4e396f3"
        },
        {
          "path": "src/app/(identity)/cuenta/operations-status-panel.js",
          "sha256": "e069565737378ca2583609a4b978d1ac6efdf9da922736b1bcf70d4674e84b5e"
        },
        {
          "path": "src/app/(identity)/cuenta/operations-status-panel.module.css",
          "sha256": "73d25fe9f75c2144aeb337dd0737c3cae3f07fb98c9acb39d6e6c88a4e6053ef"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-number-panel.js",
          "sha256": "d2146290e43adb77dc14b707787023a24ffe80c39e69eaa49fc876dcab3d267b"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-number-view.mjs",
          "sha256": "6940f11e30d2958d7f6771463ce28ca83c0e2d2f41e81aa220c8efe669580300"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-templates-panel.js",
          "sha256": "bf75e0cd2444493f07a90923ea73c4d0251e5cef0ab8516b8693cff395d5e91d"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-templates-view.mjs",
          "sha256": "3bf758b150336613a437e2b01d3b6a79645a024b771f1515f4ec2ae58a1b8bc3"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-account-discovery-format.mjs",
          "sha256": "3b9908b1a5e348dc7379a026f4e1d81942a7fa6b2b51e509fc5736586ed9fa1a"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-account-discovery.js",
          "sha256": "e53350614d51a51ba4f0d9b39a5a91bccd799fe65f3365d7746beb3fec3f6909"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-civil-data-panel.js",
          "sha256": "ea4a133fbf95065ca7a4a5ce2635cb60f80557d3f7f0c82e4129a68c42694807"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-civil-data-view.mjs",
          "sha256": "b475b011c2466d722ceecf64460b8b97eb5eedafd2fd873d5d8d97c889dcc1ff"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-kyc-capture.js",
          "sha256": "83ee427bbbecbf74aee901fd77c6981232a2cd07e235180566938c2c0201647d"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-kyc-capture.module.css",
          "sha256": "51b47533e4e6e1ce53038fc776fcd15f30e5893af472ccebd80f5e19d5e23f0f"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-kyc-chat-attempt-panel.js",
          "sha256": "153d39988f1b82e143e2c3c99b72ed0791687a70432246e16ae4c91c1fb395ee"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-kyc-chat-attempt-view.mjs",
          "sha256": "0a6aa93d1646bc7eedecf56b1dc84deb0b146f7386017eafa5affe255e40c52b"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-kyc-preanalysis-view.mjs",
          "sha256": "0e57a89f39f1ad3c0a00c27524d9c7b6a1b92d4610d7927c33f0afc791c63213"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-ocr-usage-view.mjs",
          "sha256": "29d3eecf963a9569cfc692f0f35f404c431b844d2e7f6476d62a38ad4c8ec2f9"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-office-account-view.mjs",
          "sha256": "f2716f72297a1277946bafa03a82d4c1fb7f2fcff7f4c4bbe155a86ed7e4e379"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-onboarding-next-step.mjs",
          "sha256": "18481bd2c61887a04321523aad36aa22c43406089e29f1450ff0874133a6d4ae"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-panel.js",
          "sha256": "a9d5934c7bda61c49362ac53cfb339a5d66497566f71415ecc4621686ce17519"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-panel.module.css",
          "sha256": "c1626d1a678f1060b1ccb9df106f32b041da2c3b2bd92ede3e65537aaf794c02"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline-panel.js",
          "sha256": "d2d4bb3d3129e30d9181ab56b297723e105bde52aef6be9f907914340638329d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline-view.mjs",
          "sha256": "0c696eba748a7441440e23be5085dc42d4954427def5adc1e2de686b4b11711d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline.module.css",
          "sha256": "e33df0e4af4217f0516fecf5efef8eefef4278522ccfe1f97a1ad76390441b60"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-calendar-suggestions.mjs",
          "sha256": "be73d51220557e395295700a238024d9896ef627a305718518214fc7bd227457"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-panel.js",
          "sha256": "19b79557ed1fa8d5db6d1a46201d925ea1ffc601cedb100da42bfe0768410dbf"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-panel.module.css",
          "sha256": "c64771e75e83b6708ede012f90636bac1d13c19a3c1088c685513e702cc69061"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-usage-view.mjs",
          "sha256": "666668e0267f77599f191ca5ffa038da11232ad8bb08806d2b46d9193994a186"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-measurement-panel.js",
          "sha256": "d9d1cd683a8aaf0ad1ea5656c03c12c00935c3653f54d9326196617b60039832"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-measurement-panel.module.css",
          "sha256": "8290affa492be1699acb568c2ee4c8c5c672b3f2b06e2917f541c72bdacbde3a"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-measurement-view.mjs",
          "sha256": "02a80449af709fdda97dfaf48b0335bd96ab7dc363804f59a5d9ea8579581d30"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-budget-preview.js",
          "sha256": "89868285a7cdd7a8e6f024d2e4924d45f3c811c7a24c4afe4655611f21998c15"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-budget-preview.mjs",
          "sha256": "b6f64911f619ca1f999a4fffbb26c97b94c85e33bc49bd251d55676dd63208fa"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-measurement-preview.js",
          "sha256": "e68aa0851e4d415408c21df76d3716c4e4196925223c155a96194d7db85566d8"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-measurement-preview.mjs",
          "sha256": "f30a1c21396f61a1808446d9660554132b5df654e633d128dfe2f76336a9adc5"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-source-preview.js",
          "sha256": "a37e9dc27ecc12271c1043d42ca2c3311f66cae7c3fdae6bf961f67bd639e431"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-source-preview.mjs",
          "sha256": "fcd3a41c62138e77fc026c6651a0a228d9f4507b0a87c82a3b113b0e4fc26e8d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-source-preview.module.css",
          "sha256": "301f578a68afa6878e67341f02a47b405444cea63eb6ae44eb86241b1c0da799"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.js",
          "sha256": "b0f1ef1fee082e82f18d4bd2fb13377b27d8f9849e831f2c34120164f93f9a12"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.mjs",
          "sha256": "689402d373744d159a62e2e5975ddfdf79053c528a838879dd5df3e43a0efdc9"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.module.css",
          "sha256": "92f94328baac3fb0416002db12b5c19923fc28e6f89cb625df10038e0a96a180"
        },
        {
          "path": "src/app/(identity)/cuenta/portfolio-overview-panel.js",
          "sha256": "91940070e73099386731e669d3f4059564b72d1ad82691434d64dcac17adc318"
        },
        {
          "path": "src/app/(identity)/cuenta/portfolio-overview-panel.module.css",
          "sha256": "af5230820ce3c994d93e2262bc676ae5e3d69ffa380a866095fb88d997527c8c"
        },
        {
          "path": "src/app/(identity)/cuenta/portfolio-overview-view.mjs",
          "sha256": "8446fc933db4a867235a61ffbafdbbd0bcdc94d97000d5990c795df9e884739e"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-panel.js",
          "sha256": "8c419e76293791fc441dc8685386d12498a3d3cca2938ae0cba0f7dc7c0c1180"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-panel.module.css",
          "sha256": "269dd7c7c5e43bc959ef80dd94e3ab1cfd42b96b02d9c648ab21c281329796db"
        },
        {
          "path": "src/app/(identity)/cuenta/private-workspace-download.js",
          "sha256": "d86399de71069a9ca9a1fb330692f87728bf44b8b0b59ca691d457357a0eddab"
        },
        {
          "path": "src/app/(identity)/cuenta/project-creation-format.mjs",
          "sha256": "7cef11fff2447564b56b253d2105c3589b100d8374e4633321be1b96e7e75d8f"
        },
        {
          "path": "src/app/(identity)/cuenta/project-creation-panel.js",
          "sha256": "5c0cec226b92fa2a59d1e03cb2aea489bf8016304a43bd6259e35fd45fef2d92"
        },
        {
          "path": "src/app/(identity)/cuenta/project-creation-panel.module.css",
          "sha256": "a111badb3ae7bd4c1189a19670d2096bef482c3789d01bd7400677f13dd46d06"
        },
        {
          "path": "src/app/(identity)/cuenta/project-preparation-format.mjs",
          "sha256": "7833eea1fd3b0c86733172c580b2d0178aa76cc3acae1a0b80e54e51dcb06a19"
        },
        {
          "path": "src/app/(identity)/cuenta/project-preparation-panel.js",
          "sha256": "a8d6086ce10a40c44b74e5472ee6f0a05946118014cfa93dfc4ceff4611dc2ac"
        },
        {
          "path": "src/app/(identity)/cuenta/project-preparation-panel.module.css",
          "sha256": "a7766d92df0049fa05ce4d28baf30c655bd8f268e6fbf3a8462ae2cda326ee64"
        },
        {
          "path": "src/app/(identity)/cuenta/schedule-workbench.js",
          "sha256": "b214b66dcd910728798a3084b5d3698296e458db67855f38bc820aaebee75d8c"
        },
        {
          "path": "src/app/(identity)/cuenta/schedule-workbench.mjs",
          "sha256": "12a01f0ec44b65b70ca50f5fabcba2483e964d87556dcf62db92c84d4c2ee022"
        },
        {
          "path": "src/app/(identity)/cuenta/schedule-workbench.module.css",
          "sha256": "6643a7082034e523d9aaa9ba23195634dbfdd7a37cdf0cb3b9f02cbd13f5e11b"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-panel.js",
          "sha256": "398697fb4d8850ca7f0738fc93a3f17b4313e7afdbbe9e9d1a87e9b613bd0225"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-panel.module.css",
          "sha256": "3fe757c073165128724352333e73a04f6741ac70b4c59fc0d100af025c284f04"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-view.mjs",
          "sha256": "58ebd978e8e39423901cb811ecf2ab851160b78f7cd5cb441075d66d7819dee9"
        },
        {
          "path": "src/app/(identity)/cuenta/site-register-panel.js",
          "sha256": "e8c0c456e09e9da3432dcbf01c1f4659540a596112fe28946889ae369d08d76e"
        },
        {
          "path": "src/app/(identity)/cuenta/site-register-panel.module.css",
          "sha256": "7d86974d7db3279116895cde681e231f135fb1a86e7e8b52bf74e7bb965fd0e2"
        },
        {
          "path": "src/app/(identity)/cuenta/task-create-panel.js",
          "sha256": "3d4b8f9865cdfa73b1f8c3543c4c4400babc09fe56cd21083d0bb96035445bee"
        },
        {
          "path": "src/app/(identity)/cuenta/task-progress-measurement-editor.js",
          "sha256": "2e95b587d9b6f4bfa1beb1eacdba44c4db8a7220cb6584befc6b4de79bf11eac"
        },
        {
          "path": "src/app/(identity)/cuenta/task-progress-measurement-editor.module.css",
          "sha256": "ca9b2e0432724c74a194d2648ff8dd3e7814ff192046ec02ab9f23e31d778b79"
        },
        {
          "path": "src/app/(identity)/cuenta/task-progress-measurement-view.mjs",
          "sha256": "b4b1e2645a7b4b853ba84525692b4d73596ea5490a6c000bbe9d2555cc286634"
        },
        {
          "path": "src/app/(identity)/cuenta/template-send-panel.js",
          "sha256": "c2ed4900b2f842031b713ce1d859e69e23e6278ca012c4d7b6011058c5bdc2ea"
        },
        {
          "path": "src/app/(identity)/cuenta/template-send-panel.module.css",
          "sha256": "de30d752855458140928f677e00ada91b80ad7ba574b3183b62b3d45f1e5eb56"
        },
        {
          "path": "src/app/(identity)/cuenta/template-send-view.mjs",
          "sha256": "703415b8dab1a575ebb54c9273049d2b940f93994add7177255ae26918672940"
        },
        {
          "path": "src/app/(identity)/cuenta/voice-progress-draft-view.js",
          "sha256": "a21b205b409cbbf6321036b23bc8a873d5d32388f4bad883793278531cec8d9a"
        },
        {
          "path": "src/app/(identity)/cuenta/worker-channel-panel.js",
          "sha256": "7325f3b80c5737fd39a266d0c77de703ff5515177b8945ecfa33c5250213903d"
        },
        {
          "path": "src/app/(identity)/cuenta/worker-channel-panel.module.css",
          "sha256": "28d5e1754f9345073d9a34d737f4e8b89c2f2f04e610e85c285ba81ea4f6e9ff"
        },
        {
          "path": "src/app/(identity)/cuenta/worksite-task-selector.js",
          "sha256": "d790aeec929ed1ef2ac724883988b03f6640f3882133d917760f0ddeb2a2488c"
        },
        {
          "path": "src/app/(identity)/cuenta/worksite-task-selector.module.css",
          "sha256": "12351228e827ea0e9a42a45f4d40a3fb713edd01bf0aab3ab6f58efbde7fa434"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-client.js",
          "sha256": "300e6c7f293ecc102b313c395d6e23fb520618435cf7cf5fe78e8c333e9f7cf8"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-read.mjs",
          "sha256": "a73e558f46b86a78cbe4f22783403af17061fe03e79f8e184f967448041909ec"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
          "sha256": "a61c2d017bc8dadb79fab4b0630b0404b65132d355e153bcb6a2042f5fd49511"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-refresh.js",
          "sha256": "78b056667e89f56fd9e1185c3addc6a8d40b331a0cd82146cbba17771662510a"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-overview.js",
          "sha256": "b895bbe6bd6a0186f8600edd7e335b2239dc6f05c43f6c7c514a02a1a6964fc2"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
          "sha256": "3a8d1c517fb084df425198c84671f6b76bb1f659f9d0d4ed94945cd1046d8e64"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-panel.js",
          "sha256": "063361bf78293a61a246195d5734f69a17b08c5781ae5c9f502b85dcc51ef883"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
          "sha256": "d8cf1e7e8d88d66f722aaf52deb45f95829c226468d3f37a2b23d171cc1ecbb8"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
          "sha256": "b3004538de2cc7cbc829bf5518c4f4b2a5eb2935d0b4e60f9c88840c8ede3797"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
          "sha256": "590cd7691d8b6beb82929bdd18dd9909c2d2cfa1c3d4111ff4d478d57daf532f"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-screen.js",
          "sha256": "b5c217095badf8db73842b98d86b6ae498da9f01b793ccda3683dc46be040b4a"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-session-request.mjs",
          "sha256": "29d294ac1d973317d6a3df225a64a8a9115c6ea51c587f297114e7992af97520"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-task-page.mjs",
          "sha256": "9dde484ab352b4d64d0301e735ae511d7a75ef9633439e77558dd273de1d9aa6"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-tools-navigation.js",
          "sha256": "6e3bc5b9d14973153e080a55ba55a51f1c36838641c8510af4f2f664e676ddc9"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-tools-navigation.module.css",
          "sha256": "25e6e54bc34821a658490e0276f92aae48675fdcca8f9a4b563acb49b81d5b06"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-view-routing.mjs",
          "sha256": "d02f2d11ec5ce4a1419ed79c9639cdad40174c236382853778fc984f071e4df4"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace.module.css",
          "sha256": "dfce6eb468fee571af0d0f371e68848274f22198faf89c0a6cdd5df5edc7e7a9"
        },
        {
          "path": "src/lib/company-entitlement.mjs",
          "sha256": "65d41dfb796ef12be38b1220a99ccd3dfe277419a5e5a27e125beb29fe7e2cde"
        },
        {
          "path": "src/lib/company-phone-format.mjs",
          "sha256": "67b31114f517253961c6a774210f157867b1e2e318e6b700089eef03ef1b7209"
        },
        {
          "path": "src/lib/field-hours-report.mjs",
          "sha256": "b55b767d61278bde31cb9ce4ef64faee5320fc7fe1b1bcc54559860bb4576731"
        },
        {
          "path": "src/lib/field-media-privacy.mjs",
          "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
        },
        {
          "path": "src/lib/field-media.mjs",
          "sha256": "d221ab87c4639aadb6eb8788a7203cee072f6eb1deca40605fc3d02742ab9d65"
        },
        {
          "path": "src/lib/field-operations-http.mjs",
          "sha256": "cd1773bc3b9fba01821cd4494b8559bdcdcc3a4ce886228622bb800349dcfd39"
        },
        {
          "path": "src/lib/field-operations-policy.mjs",
          "sha256": "bb33655b622a081de656f24c2e369fe7a2e05a0a0a9da7ffe455c2f39fd8fbd5"
        },
        {
          "path": "src/lib/field-operations-store.mjs",
          "sha256": "517267adb96c69bce58350b98b3a4e335ca1304a72a824e35998590e95b8987c"
        },
        {
          "path": "src/lib/field-overtime-policy.mjs",
          "sha256": "76848bd0861d6cecccb682b774599f03d3fe1322eed3cc58f5f1db5d9b1e24f8"
        },
        {
          "path": "src/lib/field-overtime-store.mjs",
          "sha256": "f29b67fff29949d5a8b14c4aed3f484ae1ce16d2ed42de486a6d5868361b1526"
        },
        {
          "path": "src/lib/field-report-feedback.mjs",
          "sha256": "70b966ae5f382abe6b5446daf1092c3f66b8f46f80ce5a0c006cffeba1cfa64c"
        },
        {
          "path": "src/lib/field-shift-summary.mjs",
          "sha256": "41f47aa7a0826ba1fe29b554c7575ec60c9861f0c18c863f06e8c3d00cb0f83c"
        },
        {
          "path": "src/lib/geo.js",
          "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
        },
        {
          "path": "src/lib/identity-return-path.mjs",
          "sha256": "91f04f80b1a2dbc7d56b8dd4b532c0540d643c2b8f48cebc25c8fcbee8ab9cf0"
        },
        {
          "path": "src/lib/material-inventory.mjs",
          "sha256": "3af0b0e9c9003d09582ec4e8b21d1e35746dd3839fc7f01071935b9a4ea95333"
        },
        {
          "path": "src/lib/meta-cloud-protocol.mjs",
          "sha256": "c6d5f1e1b4119dd2529860e3bd61a1b22d602f71ad301b2f04cec3ab4bbbed3c"
        },
        {
          "path": "src/lib/participant-approved-identity.mjs",
          "sha256": "834d81e70cedbd967ff84d880ea9d697c2168d2220fb23d9eb14c1aba1cdbbf1"
        },
        {
          "path": "src/lib/participant-kyc-image-set.mjs",
          "sha256": "190ce2560286a58d42668da7b912aeabcfa76ee14086503bf1609304e5f0e8fb"
        },
        {
          "path": "src/lib/person-worksite-journey.mjs",
          "sha256": "d3174df793150125c0b6a5d9f37d56336e72cab1efb43a361065b78ac54c210a"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/private-image-upload.mjs",
          "sha256": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60"
        },
        {
          "path": "src/lib/procurement-quantity.js",
          "sha256": "53439844051cc1dbd679220d695e60e54bc1629b2f1ddb33fc125981da9326b3"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/site-register-policy.mjs",
          "sha256": "d529c4f2225e0ec851ef7df60f8c5b182a88b384958ebfd15b194683d1590434"
        },
        {
          "path": "src/lib/site-register-store.mjs",
          "sha256": "6b744c86f47dbb6dc081132675888615d76421701f96151b00646b5e1d2529c6"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/video-audio-extractor.mjs",
          "sha256": "0c85dfd39c10fdb782eca4fe57dc665c29bd7211ab7aba0dda3f8945abcb1988"
        },
        {
          "path": "src/lib/video-frame-extractor.mjs",
          "sha256": "33425a184cf097884982c43a90e3b515726027adbeb51c2cdbfc794e79dee6e6"
        },
        {
          "path": "src/lib/voice-progress-draft.mjs",
          "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
        },
        {
          "path": "src/lib/whatsapp/tenant-workspace-policy.js",
          "sha256": "d3416ff993fbfd70f75404166cdcd8f0b9b2e5a6741f6cde03725aab16abcd5e"
        },
        {
          "path": "src/lib/workspace-http.mjs",
          "sha256": "b4e56dcd8ecbbc40c9b5f7d0e610e6f16eeb69143d46397279044e69ca5b8429"
        },
        {
          "path": "src/lib/workspace-policy.mjs",
          "sha256": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e"
        }
      ]
    },
    {
      "family": "PILOT_LIVE_BROWSER",
      "previousFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/owned-fixture-cleanup.mjs",
        "scripts/lib/worksite-live-pilot-browser-fixture.mjs",
        "scripts/lib/worksite-live-pilot-browser-scenarios.mjs",
        "scripts/verify-worksite-live-refresh-ui.mjs",
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/field-hours-report-panel.js",
        "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
        "src/app/(identity)/cuenta/field-media-capture.js",
        "src/app/(identity)/cuenta/field-media-held-view.mjs",
        "src/app/(identity)/cuenta/field-media-preparation.mjs",
        "src/app/(identity)/cuenta/field-media-preview.js",
        "src/app/(identity)/cuenta/field-operations-panel.js",
        "src/app/(identity)/cuenta/field-operations-panel.module.css",
        "src/app/(identity)/cuenta/field-overtime-view.js",
        "src/app/(identity)/cuenta/field-overtime-view.module.css",
        "src/app/(identity)/cuenta/field-qr-capture.js",
        "src/app/(identity)/cuenta/field-qr-reader.mjs",
        "src/app/(identity)/cuenta/field-review-page-view.mjs",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/private-workspace-download.js",
        "src/app/(identity)/cuenta/schedule-workbench.js",
        "src/app/(identity)/cuenta/schedule-workbench.mjs",
        "src/app/(identity)/cuenta/schedule-workbench.module.css",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/task-progress-measurement-view.mjs",
        "src/app/(identity)/cuenta/voice-progress-draft-view.js",
        "src/app/(identity)/cuenta/worksite-task-selector.js",
        "src/app/(identity)/cuenta/worksite-task-selector.module.css",
        "src/app/(identity)/cuenta/workspace-client.js",
        "src/app/(identity)/cuenta/workspace-live-read.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh.js",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/app/(identity)/cuenta/workspace-task-page.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/geo.js",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/task-progress-measurement.js",
        "src/lib/voice-progress-draft.mjs"
      ],
      "previousExternalImports": [
        "@babel/parser",
        "jsqr",
        "lucide-react",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:net",
        "node:path",
        "node:timers/promises",
        "node:url",
        "puppeteer",
        "react"
      ],
      "currentFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/owned-fixture-cleanup.mjs",
        "scripts/lib/worksite-live-pilot-browser-fixture.mjs",
        "scripts/lib/worksite-live-pilot-browser-scenarios.mjs",
        "scripts/verify-worksite-live-refresh-ui.mjs",
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/field-hours-report-panel.js",
        "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
        "src/app/(identity)/cuenta/field-media-capture.js",
        "src/app/(identity)/cuenta/field-media-held-view.mjs",
        "src/app/(identity)/cuenta/field-media-preparation.mjs",
        "src/app/(identity)/cuenta/field-media-preview.js",
        "src/app/(identity)/cuenta/field-operations-panel.js",
        "src/app/(identity)/cuenta/field-operations-panel.module.css",
        "src/app/(identity)/cuenta/field-overtime-view.js",
        "src/app/(identity)/cuenta/field-overtime-view.module.css",
        "src/app/(identity)/cuenta/field-qr-capture.js",
        "src/app/(identity)/cuenta/field-qr-reader.mjs",
        "src/app/(identity)/cuenta/field-review-page-view.mjs",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/private-workspace-download.js",
        "src/app/(identity)/cuenta/schedule-workbench.js",
        "src/app/(identity)/cuenta/schedule-workbench.mjs",
        "src/app/(identity)/cuenta/schedule-workbench.module.css",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/task-progress-measurement-view.mjs",
        "src/app/(identity)/cuenta/voice-progress-draft-view.js",
        "src/app/(identity)/cuenta/worksite-task-selector.js",
        "src/app/(identity)/cuenta/worksite-task-selector.module.css",
        "src/app/(identity)/cuenta/workspace-client.js",
        "src/app/(identity)/cuenta/workspace-live-read.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh.js",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/app/(identity)/cuenta/workspace-task-page.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/geo.js",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/task-progress-measurement.js",
        "src/lib/voice-progress-draft.mjs"
      ],
      "externalImports": [
        "@babel/parser",
        "jsqr",
        "lucide-react",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:net",
        "node:path",
        "node:timers/promises",
        "node:url",
        "puppeteer",
        "react"
      ],
      "currentManifest": [
        {
          "path": "package-lock.json",
          "sha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449"
        },
        {
          "path": "package.json",
          "sha256": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d"
        },
        {
          "path": "scripts/lib/owned-fixture-cleanup.mjs",
          "sha256": "44a9df241dd8426fe8d148b1b33110fe1e103960814e81f1f9a41638d8613844"
        },
        {
          "path": "scripts/lib/worksite-live-pilot-browser-fixture.mjs",
          "sha256": "000d2a83a3506c9ffdac0b99b7ac15194f22a5dc983308c450f90d5e601da979"
        },
        {
          "path": "scripts/lib/worksite-live-pilot-browser-scenarios.mjs",
          "sha256": "44148fa89d677a5fd15954cbf3299187c9f8e4f8afbcefb7c079529c380364e2"
        },
        {
          "path": "scripts/verify-worksite-live-refresh-ui.mjs",
          "sha256": "572658b88e7fea6d58c64567e9cfc53927347ccc2e7f462d670eb5f3b6cd9b71"
        },
        {
          "path": "src/app/(identity)/cuenta/company-channel-view.mjs",
          "sha256": "c79c473999e444b84e2a1d58e0d03f030069c24f9749f2c84450318b0b237e4d"
        },
        {
          "path": "src/app/(identity)/cuenta/field-hours-report-panel.js",
          "sha256": "d91074b8b1693c95dcf80a86fc73711fbd98a7ba482251ade68fd227166fb748"
        },
        {
          "path": "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
          "sha256": "0c8eefb85891cade983a42b7f4463962319c9fe27c0c5d157011108255c2bd75"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-capture.js",
          "sha256": "f8019225870bc6ccf04818ad7ff305798d53ea9b523400385816ba7fe2117559"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-held-view.mjs",
          "sha256": "cfc01204f973281e77a49627c7c5e32c6bdd04a1bc4c6e0a9e93773eca4faf71"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-preparation.mjs",
          "sha256": "df03121d9a7beb6b4a77946cefb09ce00710a6e22b5c8b680b180dd5a2e64a6f"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-preview.js",
          "sha256": "61506157217af690aa3ea649a2472f99acc24ec96aa10eda3cc25d24a8108441"
        },
        {
          "path": "src/app/(identity)/cuenta/field-operations-panel.js",
          "sha256": "5477d459da2e68688ce3bcf68f8f928ab0a4155144696abb2736f0c511fcd455"
        },
        {
          "path": "src/app/(identity)/cuenta/field-operations-panel.module.css",
          "sha256": "5ccd8b5beae691b9ab6ee2dc0c0ae876a5fdffe15d31d24c6807f117bd76949c"
        },
        {
          "path": "src/app/(identity)/cuenta/field-overtime-view.js",
          "sha256": "161a09cb92b09695c4007cf99c3c7755586bf8e05d7f93e147fe9f1bfb45ca60"
        },
        {
          "path": "src/app/(identity)/cuenta/field-overtime-view.module.css",
          "sha256": "e7f9e4ff4216fdb18b333d0b8cd40a5b3158e5f2e398f6207ab5cea2789fcf7a"
        },
        {
          "path": "src/app/(identity)/cuenta/field-qr-capture.js",
          "sha256": "3bc42cb87ec6554a9ac6001b199f434f087e4156139d76428d1ebaf43d12e37d"
        },
        {
          "path": "src/app/(identity)/cuenta/field-qr-reader.mjs",
          "sha256": "04157b9fc7a197271bac76d41217db8876b42dc6fbc6cb068a7052d2ea2b5b31"
        },
        {
          "path": "src/app/(identity)/cuenta/field-review-page-view.mjs",
          "sha256": "a1187150e0a3344666418b0191a898a6cf019ad2e8e5c46be2be721aee969634"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-number-view.mjs",
          "sha256": "6940f11e30d2958d7f6771463ce28ca83c0e2d2f41e81aa220c8efe669580300"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-templates-view.mjs",
          "sha256": "3bf758b150336613a437e2b01d3b6a79645a024b771f1515f4ec2ae58a1b8bc3"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-office-account-view.mjs",
          "sha256": "f2716f72297a1277946bafa03a82d4c1fb7f2fcff7f4c4bbe155a86ed7e4e379"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline-view.mjs",
          "sha256": "0c696eba748a7441440e23be5085dc42d4954427def5adc1e2de686b4b11711d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.mjs",
          "sha256": "689402d373744d159a62e2e5975ddfdf79053c528a838879dd5df3e43a0efdc9"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/app/(identity)/cuenta/private-workspace-download.js",
          "sha256": "d86399de71069a9ca9a1fb330692f87728bf44b8b0b59ca691d457357a0eddab"
        },
        {
          "path": "src/app/(identity)/cuenta/schedule-workbench.js",
          "sha256": "b214b66dcd910728798a3084b5d3698296e458db67855f38bc820aaebee75d8c"
        },
        {
          "path": "src/app/(identity)/cuenta/schedule-workbench.mjs",
          "sha256": "12a01f0ec44b65b70ca50f5fabcba2483e964d87556dcf62db92c84d4c2ee022"
        },
        {
          "path": "src/app/(identity)/cuenta/schedule-workbench.module.css",
          "sha256": "6643a7082034e523d9aaa9ba23195634dbfdd7a37cdf0cb3b9f02cbd13f5e11b"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-view.mjs",
          "sha256": "58ebd978e8e39423901cb811ecf2ab851160b78f7cd5cb441075d66d7819dee9"
        },
        {
          "path": "src/app/(identity)/cuenta/task-progress-measurement-view.mjs",
          "sha256": "b4b1e2645a7b4b853ba84525692b4d73596ea5490a6c000bbe9d2555cc286634"
        },
        {
          "path": "src/app/(identity)/cuenta/voice-progress-draft-view.js",
          "sha256": "a21b205b409cbbf6321036b23bc8a873d5d32388f4bad883793278531cec8d9a"
        },
        {
          "path": "src/app/(identity)/cuenta/worksite-task-selector.js",
          "sha256": "d790aeec929ed1ef2ac724883988b03f6640f3882133d917760f0ddeb2a2488c"
        },
        {
          "path": "src/app/(identity)/cuenta/worksite-task-selector.module.css",
          "sha256": "12351228e827ea0e9a42a45f4d40a3fb713edd01bf0aab3ab6f58efbde7fa434"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-client.js",
          "sha256": "300e6c7f293ecc102b313c395d6e23fb520618435cf7cf5fe78e8c333e9f7cf8"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-read.mjs",
          "sha256": "a73e558f46b86a78cbe4f22783403af17061fe03e79f8e184f967448041909ec"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
          "sha256": "a61c2d017bc8dadb79fab4b0630b0404b65132d355e153bcb6a2042f5fd49511"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-refresh.js",
          "sha256": "78b056667e89f56fd9e1185c3addc6a8d40b331a0cd82146cbba17771662510a"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
          "sha256": "3a8d1c517fb084df425198c84671f6b76bb1f659f9d0d4ed94945cd1046d8e64"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
          "sha256": "d8cf1e7e8d88d66f722aaf52deb45f95829c226468d3f37a2b23d171cc1ecbb8"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
          "sha256": "b3004538de2cc7cbc829bf5518c4f4b2a5eb2935d0b4e60f9c88840c8ede3797"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
          "sha256": "590cd7691d8b6beb82929bdd18dd9909c2d2cfa1c3d4111ff4d478d57daf532f"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-session-request.mjs",
          "sha256": "29d294ac1d973317d6a3df225a64a8a9115c6ea51c587f297114e7992af97520"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-task-page.mjs",
          "sha256": "9dde484ab352b4d64d0301e735ae511d7a75ef9633439e77558dd273de1d9aa6"
        },
        {
          "path": "src/lib/field-media-privacy.mjs",
          "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
        },
        {
          "path": "src/lib/geo.js",
          "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/voice-progress-draft.mjs",
          "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
        }
      ]
    },
    {
      "family": "HOURS_POSTGRES_NATIVE",
      "previousFiles": [
        "scripts/lib/disposable-postgres-cleanup.mjs",
        "scripts/verify-field-hours-postgres.mjs",
        "scripts/verify-field-operations-postgres.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-http.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/workspace-http.mjs",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-store.mjs"
      ],
      "previousExternalImports": [
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "pg"
      ],
      "currentFiles": [
        "scripts/lib/disposable-postgres-cleanup.mjs",
        "scripts/verify-field-hours-postgres.mjs",
        "scripts/verify-field-operations-postgres.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-http.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/workspace-http.mjs",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-store.mjs"
      ],
      "externalImports": [
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "pg"
      ],
      "currentManifest": [
        {
          "path": "scripts/lib/disposable-postgres-cleanup.mjs",
          "sha256": "df8d9f36b79cdd5f2d940c0dc4bbc88acbb0bec6e66c9ee5ae93ad5c6e4ab89e"
        },
        {
          "path": "scripts/verify-field-hours-postgres.mjs",
          "sha256": "b71ba90dff2a61d45151792c353c012e42debbaf1bf3a497f5ce638f5396783c"
        },
        {
          "path": "scripts/verify-field-operations-postgres.mjs",
          "sha256": "4eb11afda80e9274e3fecdc229d12f21d53d29d444e6932e44837f257800ccc2"
        },
        {
          "path": "src/lib/field-hours-report.mjs",
          "sha256": "b55b767d61278bde31cb9ce4ef64faee5320fc7fe1b1bcc54559860bb4576731"
        },
        {
          "path": "src/lib/field-media-privacy.mjs",
          "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
        },
        {
          "path": "src/lib/field-media.mjs",
          "sha256": "d221ab87c4639aadb6eb8788a7203cee072f6eb1deca40605fc3d02742ab9d65"
        },
        {
          "path": "src/lib/field-operations-http.mjs",
          "sha256": "cd1773bc3b9fba01821cd4494b8559bdcdcc3a4ce886228622bb800349dcfd39"
        },
        {
          "path": "src/lib/field-operations-policy.mjs",
          "sha256": "bb33655b622a081de656f24c2e369fe7a2e05a0a0a9da7ffe455c2f39fd8fbd5"
        },
        {
          "path": "src/lib/field-operations-store.mjs",
          "sha256": "517267adb96c69bce58350b98b3a4e335ca1304a72a824e35998590e95b8987c"
        },
        {
          "path": "src/lib/field-overtime-policy.mjs",
          "sha256": "76848bd0861d6cecccb682b774599f03d3fe1322eed3cc58f5f1db5d9b1e24f8"
        },
        {
          "path": "src/lib/field-overtime-store.mjs",
          "sha256": "f29b67fff29949d5a8b14c4aed3f484ae1ce16d2ed42de486a6d5868361b1526"
        },
        {
          "path": "src/lib/field-report-feedback.mjs",
          "sha256": "70b966ae5f382abe6b5446daf1092c3f66b8f46f80ce5a0c006cffeba1cfa64c"
        },
        {
          "path": "src/lib/field-shift-summary.mjs",
          "sha256": "41f47aa7a0826ba1fe29b554c7575ec60c9861f0c18c863f06e8c3d00cb0f83c"
        },
        {
          "path": "src/lib/geo.js",
          "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
        },
        {
          "path": "src/lib/material-inventory.mjs",
          "sha256": "3af0b0e9c9003d09582ec4e8b21d1e35746dd3839fc7f01071935b9a4ea95333"
        },
        {
          "path": "src/lib/meta-cloud-protocol.mjs",
          "sha256": "c6d5f1e1b4119dd2529860e3bd61a1b22d602f71ad301b2f04cec3ab4bbbed3c"
        },
        {
          "path": "src/lib/participant-admission.mjs",
          "sha256": "2cbb466e49d742cd23da1bb85a4e89b7e411dc724c8d1f2eb66b39717f283dd9"
        },
        {
          "path": "src/lib/participant-approved-identity.mjs",
          "sha256": "834d81e70cedbd967ff84d880ea9d697c2168d2220fb23d9eb14c1aba1cdbbf1"
        },
        {
          "path": "src/lib/participant-kyc-image-set.mjs",
          "sha256": "190ce2560286a58d42668da7b912aeabcfa76ee14086503bf1609304e5f0e8fb"
        },
        {
          "path": "src/lib/person-worksite-journey.mjs",
          "sha256": "d3174df793150125c0b6a5d9f37d56336e72cab1efb43a361065b78ac54c210a"
        },
        {
          "path": "src/lib/private-image-upload.mjs",
          "sha256": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60"
        },
        {
          "path": "src/lib/procurement-quantity.js",
          "sha256": "53439844051cc1dbd679220d695e60e54bc1629b2f1ddb33fc125981da9326b3"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/site-register-policy.mjs",
          "sha256": "d529c4f2225e0ec851ef7df60f8c5b182a88b384958ebfd15b194683d1590434"
        },
        {
          "path": "src/lib/site-register-store.mjs",
          "sha256": "6b744c86f47dbb6dc081132675888615d76421701f96151b00646b5e1d2529c6"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/video-audio-extractor.mjs",
          "sha256": "0c85dfd39c10fdb782eca4fe57dc665c29bd7211ab7aba0dda3f8945abcb1988"
        },
        {
          "path": "src/lib/video-frame-extractor.mjs",
          "sha256": "33425a184cf097884982c43a90e3b515726027adbeb51c2cdbfc794e79dee6e6"
        },
        {
          "path": "src/lib/voice-progress-draft.mjs",
          "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
        },
        {
          "path": "src/lib/workspace-http.mjs",
          "sha256": "b4e56dcd8ecbbc40c9b5f7d0e610e6f16eeb69143d46397279044e69ca5b8429"
        },
        {
          "path": "src/lib/workspace-policy.mjs",
          "sha256": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e"
        },
        {
          "path": "src/lib/workspace-store.mjs",
          "sha256": "5f25092121a31a06eefa59d69866db82fa3cd28afdcbd0e066e52d916478bc50"
        }
      ]
    },
    {
      "family": "HOURS_BROWSER",
      "previousFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/owned-fixture-cleanup.mjs",
        "scripts/lib/worksite-hours-browser-data.mjs",
        "scripts/lib/worksite-hours-browser-fixture.mjs",
        "scripts/verify-field-hours-report-ui.mjs",
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/field-hours-report-panel.js",
        "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
        "src/app/(identity)/cuenta/field-operations-panel.module.css",
        "src/app/(identity)/cuenta/field-overtime-view.js",
        "src/app/(identity)/cuenta/field-overtime-view.module.css",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-http.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/workspace-http.mjs",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-store.mjs",
        "tests/helpers/field-hours-fixture.mjs",
        "tests/helpers/field-hours-network-guard.mjs"
      ],
      "previousExternalImports": [
        "@babel/parser",
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:dgram",
        "node:fs",
        "node:fs/promises",
        "node:http",
        "node:https",
        "node:module",
        "node:net",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:test",
        "node:timers/promises",
        "node:tls",
        "node:url",
        "puppeteer",
        "react"
      ],
      "currentFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/owned-fixture-cleanup.mjs",
        "scripts/lib/worksite-hours-browser-data.mjs",
        "scripts/lib/worksite-hours-browser-fixture.mjs",
        "scripts/verify-field-hours-report-ui.mjs",
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/field-hours-report-panel.js",
        "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
        "src/app/(identity)/cuenta/field-operations-panel.module.css",
        "src/app/(identity)/cuenta/field-overtime-view.js",
        "src/app/(identity)/cuenta/field-overtime-view.module.css",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-http.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/workspace-http.mjs",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-store.mjs",
        "tests/helpers/field-hours-fixture.mjs",
        "tests/helpers/field-hours-network-guard.mjs"
      ],
      "externalImports": [
        "@babel/parser",
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:dgram",
        "node:fs",
        "node:fs/promises",
        "node:http",
        "node:https",
        "node:module",
        "node:net",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:test",
        "node:timers/promises",
        "node:tls",
        "node:url",
        "puppeteer",
        "react"
      ],
      "currentManifest": [
        {
          "path": "package-lock.json",
          "sha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449"
        },
        {
          "path": "package.json",
          "sha256": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d"
        },
        {
          "path": "scripts/lib/owned-fixture-cleanup.mjs",
          "sha256": "44a9df241dd8426fe8d148b1b33110fe1e103960814e81f1f9a41638d8613844"
        },
        {
          "path": "scripts/lib/worksite-hours-browser-data.mjs",
          "sha256": "7f9bc36ae2054fc3b780133daa004788e4e0d1f151132a7c563a40947ea6d6e3"
        },
        {
          "path": "scripts/lib/worksite-hours-browser-fixture.mjs",
          "sha256": "38bfa5aa95b13482f4ad57ec1f13ea7f75e8b6d034ab8cc9b04181883e98be42"
        },
        {
          "path": "scripts/verify-field-hours-report-ui.mjs",
          "sha256": "ef9b8db8a20964b891002db3cdc03ea0b439f3fe855d98edaf775a7a461edd34"
        },
        {
          "path": "src/app/(identity)/cuenta/company-channel-view.mjs",
          "sha256": "c79c473999e444b84e2a1d58e0d03f030069c24f9749f2c84450318b0b237e4d"
        },
        {
          "path": "src/app/(identity)/cuenta/field-hours-report-panel.js",
          "sha256": "d91074b8b1693c95dcf80a86fc73711fbd98a7ba482251ade68fd227166fb748"
        },
        {
          "path": "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
          "sha256": "0c8eefb85891cade983a42b7f4463962319c9fe27c0c5d157011108255c2bd75"
        },
        {
          "path": "src/app/(identity)/cuenta/field-operations-panel.module.css",
          "sha256": "5ccd8b5beae691b9ab6ee2dc0c0ae876a5fdffe15d31d24c6807f117bd76949c"
        },
        {
          "path": "src/app/(identity)/cuenta/field-overtime-view.js",
          "sha256": "161a09cb92b09695c4007cf99c3c7755586bf8e05d7f93e147fe9f1bfb45ca60"
        },
        {
          "path": "src/app/(identity)/cuenta/field-overtime-view.module.css",
          "sha256": "e7f9e4ff4216fdb18b333d0b8cd40a5b3158e5f2e398f6207ab5cea2789fcf7a"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-number-view.mjs",
          "sha256": "6940f11e30d2958d7f6771463ce28ca83c0e2d2f41e81aa220c8efe669580300"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-templates-view.mjs",
          "sha256": "3bf758b150336613a437e2b01d3b6a79645a024b771f1515f4ec2ae58a1b8bc3"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-office-account-view.mjs",
          "sha256": "f2716f72297a1277946bafa03a82d4c1fb7f2fcff7f4c4bbe155a86ed7e4e379"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline-view.mjs",
          "sha256": "0c696eba748a7441440e23be5085dc42d4954427def5adc1e2de686b4b11711d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.mjs",
          "sha256": "689402d373744d159a62e2e5975ddfdf79053c528a838879dd5df3e43a0efdc9"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-view.mjs",
          "sha256": "58ebd978e8e39423901cb811ecf2ab851160b78f7cd5cb441075d66d7819dee9"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
          "sha256": "3a8d1c517fb084df425198c84671f6b76bb1f659f9d0d4ed94945cd1046d8e64"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
          "sha256": "d8cf1e7e8d88d66f722aaf52deb45f95829c226468d3f37a2b23d171cc1ecbb8"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
          "sha256": "b3004538de2cc7cbc829bf5518c4f4b2a5eb2935d0b4e60f9c88840c8ede3797"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
          "sha256": "590cd7691d8b6beb82929bdd18dd9909c2d2cfa1c3d4111ff4d478d57daf532f"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-session-request.mjs",
          "sha256": "29d294ac1d973317d6a3df225a64a8a9115c6ea51c587f297114e7992af97520"
        },
        {
          "path": "src/lib/field-hours-report.mjs",
          "sha256": "b55b767d61278bde31cb9ce4ef64faee5320fc7fe1b1bcc54559860bb4576731"
        },
        {
          "path": "src/lib/field-media-privacy.mjs",
          "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
        },
        {
          "path": "src/lib/field-media.mjs",
          "sha256": "d221ab87c4639aadb6eb8788a7203cee072f6eb1deca40605fc3d02742ab9d65"
        },
        {
          "path": "src/lib/field-operations-http.mjs",
          "sha256": "cd1773bc3b9fba01821cd4494b8559bdcdcc3a4ce886228622bb800349dcfd39"
        },
        {
          "path": "src/lib/field-operations-policy.mjs",
          "sha256": "bb33655b622a081de656f24c2e369fe7a2e05a0a0a9da7ffe455c2f39fd8fbd5"
        },
        {
          "path": "src/lib/field-operations-store.mjs",
          "sha256": "517267adb96c69bce58350b98b3a4e335ca1304a72a824e35998590e95b8987c"
        },
        {
          "path": "src/lib/field-overtime-policy.mjs",
          "sha256": "76848bd0861d6cecccb682b774599f03d3fe1322eed3cc58f5f1db5d9b1e24f8"
        },
        {
          "path": "src/lib/field-overtime-store.mjs",
          "sha256": "f29b67fff29949d5a8b14c4aed3f484ae1ce16d2ed42de486a6d5868361b1526"
        },
        {
          "path": "src/lib/field-report-feedback.mjs",
          "sha256": "70b966ae5f382abe6b5446daf1092c3f66b8f46f80ce5a0c006cffeba1cfa64c"
        },
        {
          "path": "src/lib/field-shift-summary.mjs",
          "sha256": "41f47aa7a0826ba1fe29b554c7575ec60c9861f0c18c863f06e8c3d00cb0f83c"
        },
        {
          "path": "src/lib/geo.js",
          "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
        },
        {
          "path": "src/lib/material-inventory.mjs",
          "sha256": "3af0b0e9c9003d09582ec4e8b21d1e35746dd3839fc7f01071935b9a4ea95333"
        },
        {
          "path": "src/lib/meta-cloud-protocol.mjs",
          "sha256": "c6d5f1e1b4119dd2529860e3bd61a1b22d602f71ad301b2f04cec3ab4bbbed3c"
        },
        {
          "path": "src/lib/participant-admission.mjs",
          "sha256": "2cbb466e49d742cd23da1bb85a4e89b7e411dc724c8d1f2eb66b39717f283dd9"
        },
        {
          "path": "src/lib/participant-approved-identity.mjs",
          "sha256": "834d81e70cedbd967ff84d880ea9d697c2168d2220fb23d9eb14c1aba1cdbbf1"
        },
        {
          "path": "src/lib/participant-kyc-image-set.mjs",
          "sha256": "190ce2560286a58d42668da7b912aeabcfa76ee14086503bf1609304e5f0e8fb"
        },
        {
          "path": "src/lib/person-worksite-journey.mjs",
          "sha256": "d3174df793150125c0b6a5d9f37d56336e72cab1efb43a361065b78ac54c210a"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/private-image-upload.mjs",
          "sha256": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60"
        },
        {
          "path": "src/lib/procurement-quantity.js",
          "sha256": "53439844051cc1dbd679220d695e60e54bc1629b2f1ddb33fc125981da9326b3"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/site-register-policy.mjs",
          "sha256": "d529c4f2225e0ec851ef7df60f8c5b182a88b384958ebfd15b194683d1590434"
        },
        {
          "path": "src/lib/site-register-store.mjs",
          "sha256": "6b744c86f47dbb6dc081132675888615d76421701f96151b00646b5e1d2529c6"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/video-audio-extractor.mjs",
          "sha256": "0c85dfd39c10fdb782eca4fe57dc665c29bd7211ab7aba0dda3f8945abcb1988"
        },
        {
          "path": "src/lib/video-frame-extractor.mjs",
          "sha256": "33425a184cf097884982c43a90e3b515726027adbeb51c2cdbfc794e79dee6e6"
        },
        {
          "path": "src/lib/voice-progress-draft.mjs",
          "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
        },
        {
          "path": "src/lib/workspace-http.mjs",
          "sha256": "b4e56dcd8ecbbc40c9b5f7d0e610e6f16eeb69143d46397279044e69ca5b8429"
        },
        {
          "path": "src/lib/workspace-policy.mjs",
          "sha256": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e"
        },
        {
          "path": "src/lib/workspace-store.mjs",
          "sha256": "5f25092121a31a06eefa59d69866db82fa3cd28afdcbd0e066e52d916478bc50"
        },
        {
          "path": "tests/helpers/field-hours-fixture.mjs",
          "sha256": "4c6be9a5f41069ee712a6920ca70833d666472ee70c46f0ba8765b98992ca803"
        },
        {
          "path": "tests/helpers/field-hours-network-guard.mjs",
          "sha256": "ff150436eac8bb9be3462df17f1be7b9330aac9501687d68c7ae30265d2a66bd"
        }
      ]
    },
    {
      "family": "UI_FOCUSED_WORKSPACE",
      "previousFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/home-decisions-current-ci-lineage.mjs",
        "scripts/lib/integrated-identity-current-ci-lineage.mjs",
        "scripts/lib/material-review-current-ci-lineage.mjs",
        "scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs",
        "scripts/lib/owned-fixture-cleanup.mjs",
        "scripts/lib/participant-preanalysis-current-ci-lineage.mjs",
        "scripts/lib/plan-measurement-document-association-ci-lineage.mjs",
        "scripts/lib/plan-partida-preview-current-ci-lineage.mjs",
        "scripts/lib/plan-partida-preview-current-ci-reviewed.mjs",
        "scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs",
        "scripts/lib/worksite-live-hours-current-ci-lineage.mjs",
        "scripts/lib/worksite-live-hours-current-ci-reviewed.mjs",
        "scripts/lib/workspace-continuity-current-ci-lineage.mjs",
        "scripts/verify-focused-workspace-ci.mjs",
        "scripts/verify-focused-workspace-ui.mjs",
        "src/app/(identity)/cuenta/company-bootstrap-panel.js",
        "src/app/(identity)/cuenta/company-bootstrap-panel.module.css",
        "src/app/(identity)/cuenta/company-channel-panel.js",
        "src/app/(identity)/cuenta/company-channel-panel.module.css",
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/company-subscription-panel.js",
        "src/app/(identity)/cuenta/company-subscription-panel.module.css",
        "src/app/(identity)/cuenta/company-subscription-view.mjs",
        "src/app/(identity)/cuenta/company-usage-panel.js",
        "src/app/(identity)/cuenta/company-usage-view.mjs",
        "src/app/(identity)/cuenta/constructor-crm-panel.js",
        "src/app/(identity)/cuenta/constructor-crm-panel.module.css",
        "src/app/(identity)/cuenta/constructor-crm-view.mjs",
        "src/app/(identity)/cuenta/customer-inbox-panel.js",
        "src/app/(identity)/cuenta/customer-inbox-panel.module.css",
        "src/app/(identity)/cuenta/customer-inbox-view.mjs",
        "src/app/(identity)/cuenta/customer-whatsapp-panel.js",
        "src/app/(identity)/cuenta/customer-whatsapp-panel.module.css",
        "src/app/(identity)/cuenta/customer-whatsapp-view.mjs",
        "src/app/(identity)/cuenta/demo-pilot-panel.js",
        "src/app/(identity)/cuenta/demo-pilot-view.mjs",
        "src/app/(identity)/cuenta/employee-intake-continuity.mjs",
        "src/app/(identity)/cuenta/employee-intake-panel.js",
        "src/app/(identity)/cuenta/field-hours-report-panel.js",
        "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
        "src/app/(identity)/cuenta/field-media-capture.js",
        "src/app/(identity)/cuenta/field-media-held-view.mjs",
        "src/app/(identity)/cuenta/field-media-preparation.mjs",
        "src/app/(identity)/cuenta/field-media-preview.js",
        "src/app/(identity)/cuenta/field-operations-panel.js",
        "src/app/(identity)/cuenta/field-operations-panel.module.css",
        "src/app/(identity)/cuenta/field-overtime-view.js",
        "src/app/(identity)/cuenta/field-overtime-view.module.css",
        "src/app/(identity)/cuenta/field-qr-capture.js",
        "src/app/(identity)/cuenta/field-qr-reader.mjs",
        "src/app/(identity)/cuenta/field-review-page-view.mjs",
        "src/app/(identity)/cuenta/invitation-entry.js",
        "src/app/(identity)/cuenta/kyc-photo-preparation.js",
        "src/app/(identity)/cuenta/material-inventory-panel.js",
        "src/app/(identity)/cuenta/material-inventory-panel.module.css",
        "src/app/(identity)/cuenta/material-inventory-view.mjs",
        "src/app/(identity)/cuenta/meta-existing-api-plan-view.mjs",
        "src/app/(identity)/cuenta/meta-onboarding-panel.js",
        "src/app/(identity)/cuenta/meta-onboarding-panel.module.css",
        "src/app/(identity)/cuenta/meta-onboarding-readiness-view.mjs",
        "src/app/(identity)/cuenta/meta-sdk-loader.mjs",
        "src/app/(identity)/cuenta/office-review-panel.js",
        "src/app/(identity)/cuenta/office-review-panel.module.css",
        "src/app/(identity)/cuenta/office-review-view.mjs",
        "src/app/(identity)/cuenta/onboarding-guide.js",
        "src/app/(identity)/cuenta/onboarding-guide.module.css",
        "src/app/(identity)/cuenta/operations-status-panel.js",
        "src/app/(identity)/cuenta/operations-status-panel.module.css",
        "src/app/(identity)/cuenta/own-company-number-panel.js",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-panel.js",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/page.js",
        "src/app/(identity)/cuenta/participant-account-discovery-format.mjs",
        "src/app/(identity)/cuenta/participant-account-discovery.js",
        "src/app/(identity)/cuenta/participant-civil-data-panel.js",
        "src/app/(identity)/cuenta/participant-civil-data-view.mjs",
        "src/app/(identity)/cuenta/participant-kyc-capture.js",
        "src/app/(identity)/cuenta/participant-kyc-capture.module.css",
        "src/app/(identity)/cuenta/participant-kyc-chat-attempt-panel.js",
        "src/app/(identity)/cuenta/participant-kyc-chat-attempt-view.mjs",
        "src/app/(identity)/cuenta/participant-kyc-preanalysis-view.mjs",
        "src/app/(identity)/cuenta/participant-ocr-usage-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/participant-onboarding-next-step.mjs",
        "src/app/(identity)/cuenta/participant-panel.js",
        "src/app/(identity)/cuenta/participant-panel.module.css",
        "src/app/(identity)/cuenta/plan-baseline-panel.js",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline.module.css",
        "src/app/(identity)/cuenta/plan-import-calendar-suggestions.mjs",
        "src/app/(identity)/cuenta/plan-import-panel.js",
        "src/app/(identity)/cuenta/plan-import-panel.module.css",
        "src/app/(identity)/cuenta/plan-import-usage-view.mjs",
        "src/app/(identity)/cuenta/plan-measurement-panel.js",
        "src/app/(identity)/cuenta/plan-measurement-panel.module.css",
        "src/app/(identity)/cuenta/plan-measurement-view.mjs",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.js",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.js",
        "src/app/(identity)/cuenta/plan-partida-source-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.module.css",
        "src/app/(identity)/cuenta/plan-source-curve.js",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.module.css",
        "src/app/(identity)/cuenta/portfolio-overview-panel.js",
        "src/app/(identity)/cuenta/portfolio-overview-panel.module.css",
        "src/app/(identity)/cuenta/portfolio-overview-view.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/private-bank-account-panel.js",
        "src/app/(identity)/cuenta/private-bank-account-panel.module.css",
        "src/app/(identity)/cuenta/private-workspace-download.js",
        "src/app/(identity)/cuenta/project-creation-format.mjs",
        "src/app/(identity)/cuenta/project-creation-panel.js",
        "src/app/(identity)/cuenta/project-creation-panel.module.css",
        "src/app/(identity)/cuenta/project-preparation-format.mjs",
        "src/app/(identity)/cuenta/project-preparation-panel.js",
        "src/app/(identity)/cuenta/project-preparation-panel.module.css",
        "src/app/(identity)/cuenta/schedule-workbench.js",
        "src/app/(identity)/cuenta/schedule-workbench.mjs",
        "src/app/(identity)/cuenta/schedule-workbench.module.css",
        "src/app/(identity)/cuenta/session-recovery.js",
        "src/app/(identity)/cuenta/site-purchase-panel.js",
        "src/app/(identity)/cuenta/site-purchase-panel.module.css",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/site-register-panel.js",
        "src/app/(identity)/cuenta/site-register-panel.module.css",
        "src/app/(identity)/cuenta/task-create-panel.js",
        "src/app/(identity)/cuenta/task-progress-measurement-editor.js",
        "src/app/(identity)/cuenta/task-progress-measurement-editor.module.css",
        "src/app/(identity)/cuenta/task-progress-measurement-view.mjs",
        "src/app/(identity)/cuenta/template-send-panel.js",
        "src/app/(identity)/cuenta/template-send-panel.module.css",
        "src/app/(identity)/cuenta/template-send-view.mjs",
        "src/app/(identity)/cuenta/voice-progress-draft-view.js",
        "src/app/(identity)/cuenta/worker-channel-panel.js",
        "src/app/(identity)/cuenta/worker-channel-panel.module.css",
        "src/app/(identity)/cuenta/worksite-task-selector.js",
        "src/app/(identity)/cuenta/worksite-task-selector.module.css",
        "src/app/(identity)/cuenta/workspace-client.js",
        "src/app/(identity)/cuenta/workspace-identity.js",
        "src/app/(identity)/cuenta/workspace-live-read.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh.js",
        "src/app/(identity)/cuenta/workspace-overview.js",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-panel.js",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-screen.js",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/app/(identity)/cuenta/workspace-task-page.mjs",
        "src/app/(identity)/cuenta/workspace-tools-navigation.js",
        "src/app/(identity)/cuenta/workspace-tools-navigation.module.css",
        "src/app/(identity)/cuenta/workspace-view-routing.mjs",
        "src/app/(identity)/cuenta/workspace.module.css",
        "src/app/(identity)/identity-load-guard.js",
        "src/app/(identity)/identity.module.css",
        "src/app/brand/brand-geometry.js",
        "src/app/brand/brand-logo.js",
        "src/app/brand/brand-logo.module.css",
        "src/lib/company-entitlement.mjs",
        "src/lib/company-phone-format.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/geo.js",
        "src/lib/identity-return-path.mjs",
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-bank-format.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/participant-onboarding-policy.mjs",
        "src/lib/participant-policy.mjs",
        "src/lib/participant-verified-office.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/production-identity-config.mjs",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/session-recovery.mjs",
        "src/lib/site-register-policy.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/verified-session.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/whatsapp/tenant-workspace-policy.js",
        "src/lib/workspace-policy.mjs",
        "tests/fixtures/integrated-identity-contract-27aa.json",
        "tests/fixtures/plan-measurement-contract-a203.json",
        "tests/fixtures/whatsapp-field-continuity-contract-052.json",
        "tests/fixtures/workspace-continuity-contract-d5d.json",
        "tests/production-company-bootstrap-receipt.test.mjs",
        "tests/production-focused-workspace-ci.test.mjs",
        "tests/production-focused-workspace-continuity-ui.test.mjs",
        "tests/production-focused-workspace-navigation.test.mjs",
        "tests/production-focused-workspace-task-pagination.test.mjs",
        "tests/production-focused-workspace-ui.test.mjs",
        "tests/production-integrated-identity-current-ci-lineage.test.mjs"
      ],
      "previousExternalImports": [
        "@babel/parser",
        "@clerk/nextjs",
        "jose",
        "jsqr",
        "lucide-react",
        "next/dist/build/swc/index.js",
        "next/headers",
        "next/link",
        "next/navigation",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:net",
        "node:path",
        "node:test",
        "node:timers/promises",
        "node:url",
        "node:zlib",
        "puppeteer",
        "react",
        "react-dom/server"
      ],
      "currentFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/home-decisions-current-ci-lineage.mjs",
        "scripts/lib/integrated-identity-current-ci-lineage.mjs",
        "scripts/lib/material-review-current-ci-lineage.mjs",
        "scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs",
        "scripts/lib/owned-fixture-cleanup.mjs",
        "scripts/lib/participant-preanalysis-current-ci-lineage.mjs",
        "scripts/lib/plan-budget-current-ci-lineage.mjs",
        "scripts/lib/plan-budget-current-ci-reviewed.mjs",
        "scripts/lib/plan-measurement-document-association-ci-lineage.mjs",
        "scripts/lib/plan-partida-preview-current-ci-lineage.mjs",
        "scripts/lib/plan-partida-preview-current-ci-reviewed.mjs",
        "scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs",
        "scripts/lib/worksite-live-hours-current-ci-lineage.mjs",
        "scripts/lib/worksite-live-hours-current-ci-reviewed.mjs",
        "scripts/lib/workspace-continuity-current-ci-lineage.mjs",
        "scripts/verify-focused-workspace-ci.mjs",
        "scripts/verify-focused-workspace-ui.mjs",
        "src/app/(identity)/cuenta/company-bootstrap-panel.js",
        "src/app/(identity)/cuenta/company-bootstrap-panel.module.css",
        "src/app/(identity)/cuenta/company-channel-panel.js",
        "src/app/(identity)/cuenta/company-channel-panel.module.css",
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/company-subscription-panel.js",
        "src/app/(identity)/cuenta/company-subscription-panel.module.css",
        "src/app/(identity)/cuenta/company-subscription-view.mjs",
        "src/app/(identity)/cuenta/company-usage-panel.js",
        "src/app/(identity)/cuenta/company-usage-view.mjs",
        "src/app/(identity)/cuenta/constructor-crm-panel.js",
        "src/app/(identity)/cuenta/constructor-crm-panel.module.css",
        "src/app/(identity)/cuenta/constructor-crm-view.mjs",
        "src/app/(identity)/cuenta/customer-inbox-panel.js",
        "src/app/(identity)/cuenta/customer-inbox-panel.module.css",
        "src/app/(identity)/cuenta/customer-inbox-view.mjs",
        "src/app/(identity)/cuenta/customer-whatsapp-panel.js",
        "src/app/(identity)/cuenta/customer-whatsapp-panel.module.css",
        "src/app/(identity)/cuenta/customer-whatsapp-view.mjs",
        "src/app/(identity)/cuenta/demo-pilot-panel.js",
        "src/app/(identity)/cuenta/demo-pilot-view.mjs",
        "src/app/(identity)/cuenta/employee-intake-continuity.mjs",
        "src/app/(identity)/cuenta/employee-intake-panel.js",
        "src/app/(identity)/cuenta/field-hours-report-panel.js",
        "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
        "src/app/(identity)/cuenta/field-media-capture.js",
        "src/app/(identity)/cuenta/field-media-held-view.mjs",
        "src/app/(identity)/cuenta/field-media-preparation.mjs",
        "src/app/(identity)/cuenta/field-media-preview.js",
        "src/app/(identity)/cuenta/field-operations-panel.js",
        "src/app/(identity)/cuenta/field-operations-panel.module.css",
        "src/app/(identity)/cuenta/field-overtime-view.js",
        "src/app/(identity)/cuenta/field-overtime-view.module.css",
        "src/app/(identity)/cuenta/field-qr-capture.js",
        "src/app/(identity)/cuenta/field-qr-reader.mjs",
        "src/app/(identity)/cuenta/field-review-page-view.mjs",
        "src/app/(identity)/cuenta/invitation-entry.js",
        "src/app/(identity)/cuenta/kyc-photo-preparation.js",
        "src/app/(identity)/cuenta/material-inventory-panel.js",
        "src/app/(identity)/cuenta/material-inventory-panel.module.css",
        "src/app/(identity)/cuenta/material-inventory-view.mjs",
        "src/app/(identity)/cuenta/meta-existing-api-plan-view.mjs",
        "src/app/(identity)/cuenta/meta-onboarding-panel.js",
        "src/app/(identity)/cuenta/meta-onboarding-panel.module.css",
        "src/app/(identity)/cuenta/meta-onboarding-readiness-view.mjs",
        "src/app/(identity)/cuenta/meta-sdk-loader.mjs",
        "src/app/(identity)/cuenta/office-review-panel.js",
        "src/app/(identity)/cuenta/office-review-panel.module.css",
        "src/app/(identity)/cuenta/office-review-view.mjs",
        "src/app/(identity)/cuenta/onboarding-guide.js",
        "src/app/(identity)/cuenta/onboarding-guide.module.css",
        "src/app/(identity)/cuenta/operations-status-panel.js",
        "src/app/(identity)/cuenta/operations-status-panel.module.css",
        "src/app/(identity)/cuenta/own-company-number-panel.js",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-panel.js",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/page.js",
        "src/app/(identity)/cuenta/participant-account-discovery-format.mjs",
        "src/app/(identity)/cuenta/participant-account-discovery.js",
        "src/app/(identity)/cuenta/participant-civil-data-panel.js",
        "src/app/(identity)/cuenta/participant-civil-data-view.mjs",
        "src/app/(identity)/cuenta/participant-kyc-capture.js",
        "src/app/(identity)/cuenta/participant-kyc-capture.module.css",
        "src/app/(identity)/cuenta/participant-kyc-chat-attempt-panel.js",
        "src/app/(identity)/cuenta/participant-kyc-chat-attempt-view.mjs",
        "src/app/(identity)/cuenta/participant-kyc-preanalysis-view.mjs",
        "src/app/(identity)/cuenta/participant-ocr-usage-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/participant-onboarding-next-step.mjs",
        "src/app/(identity)/cuenta/participant-panel.js",
        "src/app/(identity)/cuenta/participant-panel.module.css",
        "src/app/(identity)/cuenta/plan-baseline-panel.js",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline.module.css",
        "src/app/(identity)/cuenta/plan-import-calendar-suggestions.mjs",
        "src/app/(identity)/cuenta/plan-import-panel.js",
        "src/app/(identity)/cuenta/plan-import-panel.module.css",
        "src/app/(identity)/cuenta/plan-import-usage-view.mjs",
        "src/app/(identity)/cuenta/plan-measurement-panel.js",
        "src/app/(identity)/cuenta/plan-measurement-panel.module.css",
        "src/app/(identity)/cuenta/plan-measurement-view.mjs",
        "src/app/(identity)/cuenta/plan-partida-budget-preview.js",
        "src/app/(identity)/cuenta/plan-partida-budget-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.js",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.js",
        "src/app/(identity)/cuenta/plan-partida-source-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.module.css",
        "src/app/(identity)/cuenta/plan-source-curve.js",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.module.css",
        "src/app/(identity)/cuenta/portfolio-overview-panel.js",
        "src/app/(identity)/cuenta/portfolio-overview-panel.module.css",
        "src/app/(identity)/cuenta/portfolio-overview-view.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/private-bank-account-panel.js",
        "src/app/(identity)/cuenta/private-bank-account-panel.module.css",
        "src/app/(identity)/cuenta/private-workspace-download.js",
        "src/app/(identity)/cuenta/project-creation-format.mjs",
        "src/app/(identity)/cuenta/project-creation-panel.js",
        "src/app/(identity)/cuenta/project-creation-panel.module.css",
        "src/app/(identity)/cuenta/project-preparation-format.mjs",
        "src/app/(identity)/cuenta/project-preparation-panel.js",
        "src/app/(identity)/cuenta/project-preparation-panel.module.css",
        "src/app/(identity)/cuenta/schedule-workbench.js",
        "src/app/(identity)/cuenta/schedule-workbench.mjs",
        "src/app/(identity)/cuenta/schedule-workbench.module.css",
        "src/app/(identity)/cuenta/session-recovery.js",
        "src/app/(identity)/cuenta/site-purchase-panel.js",
        "src/app/(identity)/cuenta/site-purchase-panel.module.css",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/site-register-panel.js",
        "src/app/(identity)/cuenta/site-register-panel.module.css",
        "src/app/(identity)/cuenta/task-create-panel.js",
        "src/app/(identity)/cuenta/task-progress-measurement-editor.js",
        "src/app/(identity)/cuenta/task-progress-measurement-editor.module.css",
        "src/app/(identity)/cuenta/task-progress-measurement-view.mjs",
        "src/app/(identity)/cuenta/template-send-panel.js",
        "src/app/(identity)/cuenta/template-send-panel.module.css",
        "src/app/(identity)/cuenta/template-send-view.mjs",
        "src/app/(identity)/cuenta/voice-progress-draft-view.js",
        "src/app/(identity)/cuenta/worker-channel-panel.js",
        "src/app/(identity)/cuenta/worker-channel-panel.module.css",
        "src/app/(identity)/cuenta/worksite-task-selector.js",
        "src/app/(identity)/cuenta/worksite-task-selector.module.css",
        "src/app/(identity)/cuenta/workspace-client.js",
        "src/app/(identity)/cuenta/workspace-identity.js",
        "src/app/(identity)/cuenta/workspace-live-read.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh.js",
        "src/app/(identity)/cuenta/workspace-overview.js",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-panel.js",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-screen.js",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/app/(identity)/cuenta/workspace-task-page.mjs",
        "src/app/(identity)/cuenta/workspace-tools-navigation.js",
        "src/app/(identity)/cuenta/workspace-tools-navigation.module.css",
        "src/app/(identity)/cuenta/workspace-view-routing.mjs",
        "src/app/(identity)/cuenta/workspace.module.css",
        "src/app/(identity)/identity-load-guard.js",
        "src/app/(identity)/identity.module.css",
        "src/app/brand/brand-geometry.js",
        "src/app/brand/brand-logo.js",
        "src/app/brand/brand-logo.module.css",
        "src/lib/company-entitlement.mjs",
        "src/lib/company-phone-format.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/geo.js",
        "src/lib/identity-return-path.mjs",
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-bank-format.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/participant-onboarding-policy.mjs",
        "src/lib/participant-policy.mjs",
        "src/lib/participant-verified-office.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/production-identity-config.mjs",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/session-recovery.mjs",
        "src/lib/site-register-policy.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/verified-session.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/whatsapp/tenant-workspace-policy.js",
        "src/lib/workspace-policy.mjs",
        "tests/fixtures/integrated-identity-contract-27aa.json",
        "tests/fixtures/plan-measurement-contract-a203.json",
        "tests/fixtures/whatsapp-field-continuity-contract-052.json",
        "tests/fixtures/workspace-continuity-contract-d5d.json",
        "tests/production-company-bootstrap-receipt.test.mjs",
        "tests/production-focused-workspace-ci.test.mjs",
        "tests/production-focused-workspace-continuity-ui.test.mjs",
        "tests/production-focused-workspace-navigation.test.mjs",
        "tests/production-focused-workspace-task-pagination.test.mjs",
        "tests/production-focused-workspace-ui.test.mjs",
        "tests/production-integrated-identity-current-ci-lineage.test.mjs"
      ],
      "externalImports": [
        "@babel/parser",
        "@clerk/nextjs",
        "jose",
        "jsqr",
        "lucide-react",
        "next/dist/build/swc/index.js",
        "next/headers",
        "next/link",
        "next/navigation",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:net",
        "node:path",
        "node:test",
        "node:timers/promises",
        "node:url",
        "node:zlib",
        "puppeteer",
        "react",
        "react-dom/server"
      ],
      "currentManifest": [
        {
          "path": "package-lock.json",
          "sha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449"
        },
        {
          "path": "package.json",
          "sha256": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d"
        },
        {
          "path": "scripts/lib/home-decisions-current-ci-lineage.mjs",
          "sha256": "bd61edf4351e0d3b8f7857cb26cdc169162dca5400467f2f9fbfbd5853903503"
        },
        {
          "path": "scripts/lib/integrated-identity-current-ci-lineage.mjs",
          "sha256": "aaf23ee0e97231520f29669136d969ffc513bd6b52067df751d3dc6cf9c86bb8"
        },
        {
          "path": "scripts/lib/material-review-current-ci-lineage.mjs",
          "sha256": "54bafcc5ec399197f2b3b22e6dcf2f0aa31ff18f0d2727688954533f8dc4ecc7"
        },
        {
          "path": "scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs",
          "sha256": "93763476c4dc0b193cf1e4d174f7eae71c0daf1081827d18d21cc7ee22f7d586"
        },
        {
          "path": "scripts/lib/owned-fixture-cleanup.mjs",
          "sha256": "44a9df241dd8426fe8d148b1b33110fe1e103960814e81f1f9a41638d8613844"
        },
        {
          "path": "scripts/lib/participant-preanalysis-current-ci-lineage.mjs",
          "sha256": "3c330d4f821d7f2c998dd17064c67ffdcc52dc3cfbd033c165af39e071333f7b"
        },
        {
          "path": "scripts/lib/plan-budget-current-ci-lineage.mjs",
          "sha256": "834a40911ef64844f0db441a48cef5de235ae556c301308a62ff347f7106d678"
        },
        {
          "path": "scripts/lib/plan-budget-current-ci-reviewed.mjs",
          "sha256": "REVIEWED_DECLARATION_TRUST_ANCHOR"
        },
        {
          "path": "scripts/lib/plan-measurement-document-association-ci-lineage.mjs",
          "sha256": "0a14f5211348d30d3a16b441a126880aeed8c7e196973ecceda7ee00307f0ef4"
        },
        {
          "path": "scripts/lib/plan-partida-preview-current-ci-lineage.mjs",
          "sha256": "141f5d6decf74d9dc126399ac955ac27874da785fd6c5df5f8af7bc0244d4e75"
        },
        {
          "path": "scripts/lib/plan-partida-preview-current-ci-reviewed.mjs",
          "sha256": "f908107cd26280c1b8e1001d9aeb5bc00107c0d7b39feb9b7ec2c1d539aa3e04"
        },
        {
          "path": "scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs",
          "sha256": "a1de3a73617de7c4eb2f9db8665650abe5798accb44b886cd8d2220fe5295bbf"
        },
        {
          "path": "scripts/lib/worksite-live-hours-current-ci-lineage.mjs",
          "sha256": "c78c0792ec6c9142b76090bdffc65fc026a5b333a473e833a203981bec96f448"
        },
        {
          "path": "scripts/lib/worksite-live-hours-current-ci-reviewed.mjs",
          "sha256": "8da86cb1eeb978e37843d4f722da44968e4a089fd719aa35ebd966395f784758"
        },
        {
          "path": "scripts/lib/workspace-continuity-current-ci-lineage.mjs",
          "sha256": "cb26d5ea9922fb9a3fb72d1a35010229a1d4b49f4784783294a4d1d503fdc81a"
        },
        {
          "path": "scripts/verify-focused-workspace-ci.mjs",
          "sha256": "532e37e994540a6fecd8c70d067730cddec4a66403686113cef4087828c2229c"
        },
        {
          "path": "scripts/verify-focused-workspace-ui.mjs",
          "sha256": "940bc05e5aa47d19e2251bc5559eed34e29275afff0d025f76f73a8fde41649f"
        },
        {
          "path": "src/app/(identity)/cuenta/company-bootstrap-panel.js",
          "sha256": "f8fabe5917469d3303328ebdfc447fc4c6f3bd2e1f407abbd97c4ba7b8e713d3"
        },
        {
          "path": "src/app/(identity)/cuenta/company-bootstrap-panel.module.css",
          "sha256": "a8cadc4631ef54a18578344d93b8bed8568fbd847abce0cd02c57b2e7969dcdf"
        },
        {
          "path": "src/app/(identity)/cuenta/company-channel-panel.js",
          "sha256": "b41b9fd9a0fa16a25914b8d074ffbac1588b5d26dcca0310a8626ee211154a24"
        },
        {
          "path": "src/app/(identity)/cuenta/company-channel-panel.module.css",
          "sha256": "365d5f5884c39e239e0e0bf2ce5da2d37791a2d2ce5ce2e3c5d3021cc96db66e"
        },
        {
          "path": "src/app/(identity)/cuenta/company-channel-view.mjs",
          "sha256": "c79c473999e444b84e2a1d58e0d03f030069c24f9749f2c84450318b0b237e4d"
        },
        {
          "path": "src/app/(identity)/cuenta/company-subscription-panel.js",
          "sha256": "0b208fdcbea4900bd6adf86ad80f8524b5afa647d78a24fbf5731d3d7d79c749"
        },
        {
          "path": "src/app/(identity)/cuenta/company-subscription-panel.module.css",
          "sha256": "fdede43a09f48b011f7e3cb184ea16bf0be0e98069e7a953b71b8e391b3dfa3e"
        },
        {
          "path": "src/app/(identity)/cuenta/company-subscription-view.mjs",
          "sha256": "d009632c97d18084a1907bd7dedcf140f1a5d4ee0b55dd95f33d83be152dfc9c"
        },
        {
          "path": "src/app/(identity)/cuenta/company-usage-panel.js",
          "sha256": "01beddb3b88861bda1549169cc885bc682bd5446e4289521e5a36a6386ac37aa"
        },
        {
          "path": "src/app/(identity)/cuenta/company-usage-view.mjs",
          "sha256": "27cb4b607405186f57d70ffa7d78b1b2f9456486a4bfeb40b0157c9c52a2dc29"
        },
        {
          "path": "src/app/(identity)/cuenta/constructor-crm-panel.js",
          "sha256": "9447f5d87002193e34b99c1276a958b0e00539a901e372ce4e16584358d54554"
        },
        {
          "path": "src/app/(identity)/cuenta/constructor-crm-panel.module.css",
          "sha256": "8d99b34339e2f4d434cda5abbd9a1bf11c13d1335cb407fcfad6629810d98bf4"
        },
        {
          "path": "src/app/(identity)/cuenta/constructor-crm-view.mjs",
          "sha256": "9e0520a9f15c86d9b79b85bad2067b4dcdba3c82b1d3e6b32b86f811f79bf885"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-inbox-panel.js",
          "sha256": "a933afae1cecb3e523d37904ee6f9543c958b738f6abbb4eb013cf12c1535909"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-inbox-panel.module.css",
          "sha256": "abfcade899997a72ad9789020d8223257cc35128657cae6a74df386dc22381f3"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-inbox-view.mjs",
          "sha256": "c38e1d18d59fa2be870fc90cdd748dcb3d3b24e805aa5924f4a79ae5733a001f"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-whatsapp-panel.js",
          "sha256": "d129c4aa22e8048e03674382828222e5141e219f5d12368139a75ae735c9b247"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-whatsapp-panel.module.css",
          "sha256": "00e35b2fcea0140d639c6207ae7c33476e8075c297ffec1aebebefaae3ccc136"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-whatsapp-view.mjs",
          "sha256": "baae13c4e846d6e9787a58dc9ca83ee45e3a79cafd87d104dc68c16da4b31437"
        },
        {
          "path": "src/app/(identity)/cuenta/demo-pilot-panel.js",
          "sha256": "f2d9b7bfaf481c4ca1f8b9b2120bfe688375f745508c249cf04112178dab9270"
        },
        {
          "path": "src/app/(identity)/cuenta/demo-pilot-view.mjs",
          "sha256": "8816f95d81094b0a44c8e1dec5b94b4886ee493e4dd8caaec0d9eb95adbdbf01"
        },
        {
          "path": "src/app/(identity)/cuenta/employee-intake-continuity.mjs",
          "sha256": "11ca9957e2d04545485617e2cefa939673e2ad5b3e45943b5c9ba24b28f5b8ee"
        },
        {
          "path": "src/app/(identity)/cuenta/employee-intake-panel.js",
          "sha256": "111fc1e7918fe28d2e9aa9f1dd3abc63c7d18c45e8dc6d328d1b0b3c64361b46"
        },
        {
          "path": "src/app/(identity)/cuenta/field-hours-report-panel.js",
          "sha256": "d91074b8b1693c95dcf80a86fc73711fbd98a7ba482251ade68fd227166fb748"
        },
        {
          "path": "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
          "sha256": "0c8eefb85891cade983a42b7f4463962319c9fe27c0c5d157011108255c2bd75"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-capture.js",
          "sha256": "f8019225870bc6ccf04818ad7ff305798d53ea9b523400385816ba7fe2117559"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-held-view.mjs",
          "sha256": "cfc01204f973281e77a49627c7c5e32c6bdd04a1bc4c6e0a9e93773eca4faf71"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-preparation.mjs",
          "sha256": "df03121d9a7beb6b4a77946cefb09ce00710a6e22b5c8b680b180dd5a2e64a6f"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-preview.js",
          "sha256": "61506157217af690aa3ea649a2472f99acc24ec96aa10eda3cc25d24a8108441"
        },
        {
          "path": "src/app/(identity)/cuenta/field-operations-panel.js",
          "sha256": "5477d459da2e68688ce3bcf68f8f928ab0a4155144696abb2736f0c511fcd455"
        },
        {
          "path": "src/app/(identity)/cuenta/field-operations-panel.module.css",
          "sha256": "5ccd8b5beae691b9ab6ee2dc0c0ae876a5fdffe15d31d24c6807f117bd76949c"
        },
        {
          "path": "src/app/(identity)/cuenta/field-overtime-view.js",
          "sha256": "161a09cb92b09695c4007cf99c3c7755586bf8e05d7f93e147fe9f1bfb45ca60"
        },
        {
          "path": "src/app/(identity)/cuenta/field-overtime-view.module.css",
          "sha256": "e7f9e4ff4216fdb18b333d0b8cd40a5b3158e5f2e398f6207ab5cea2789fcf7a"
        },
        {
          "path": "src/app/(identity)/cuenta/field-qr-capture.js",
          "sha256": "3bc42cb87ec6554a9ac6001b199f434f087e4156139d76428d1ebaf43d12e37d"
        },
        {
          "path": "src/app/(identity)/cuenta/field-qr-reader.mjs",
          "sha256": "04157b9fc7a197271bac76d41217db8876b42dc6fbc6cb068a7052d2ea2b5b31"
        },
        {
          "path": "src/app/(identity)/cuenta/field-review-page-view.mjs",
          "sha256": "a1187150e0a3344666418b0191a898a6cf019ad2e8e5c46be2be721aee969634"
        },
        {
          "path": "src/app/(identity)/cuenta/invitation-entry.js",
          "sha256": "a6c8a1499bcd170afb52120d56ecbddb1241a34d2aa483528d03f306e2c2a481"
        },
        {
          "path": "src/app/(identity)/cuenta/kyc-photo-preparation.js",
          "sha256": "88137686826cc411d6fcc103b0085390c0cc16f69572cf45c2385bcde69f943d"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-panel.js",
          "sha256": "f910384fa3acc4326037b4a4b0c141c1712cb95845f14d8d975705463fecd2e2"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-panel.module.css",
          "sha256": "1d7eec4afc275ee403674b187acb7844e3df519f24cd537af2e05f7b8032611c"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-view.mjs",
          "sha256": "8942cb9a2f3ed071a77a9e87ca3876fa16b1f819bcb74f395e4307f7c167605a"
        },
        {
          "path": "src/app/(identity)/cuenta/meta-existing-api-plan-view.mjs",
          "sha256": "c44cbf28f4642b7c60109668d60354acc298439653e34fd13aa6610e5e9e5588"
        },
        {
          "path": "src/app/(identity)/cuenta/meta-onboarding-panel.js",
          "sha256": "314f7b6b6e160a4c58f9f373ff6970d049ad4feefea7501a5d29ad4d63613af8"
        },
        {
          "path": "src/app/(identity)/cuenta/meta-onboarding-panel.module.css",
          "sha256": "47ddd495c465ce9c9c4d75df19c722fb35f3e9873396f95d948f43031efe760b"
        },
        {
          "path": "src/app/(identity)/cuenta/meta-onboarding-readiness-view.mjs",
          "sha256": "78d15f464576d77c5a676a8c9a682dea4a3f43113fdaa898237b75478ec5132c"
        },
        {
          "path": "src/app/(identity)/cuenta/meta-sdk-loader.mjs",
          "sha256": "3a2dcc3d99a29e7b1adffb833ae206e14990d18cc32025b4a31b21728a7c4d88"
        },
        {
          "path": "src/app/(identity)/cuenta/office-review-panel.js",
          "sha256": "6743f03b2a01fcb80f1b63069717fff0daa68e9c76bc97eed90fc7c270622ce1"
        },
        {
          "path": "src/app/(identity)/cuenta/office-review-panel.module.css",
          "sha256": "4e1ca532b4cf582d13dbd9a3de1b54f1c2ae97b360a69a5df628ad34780d9725"
        },
        {
          "path": "src/app/(identity)/cuenta/office-review-view.mjs",
          "sha256": "84762ddace81533b1684f23f9abafe8a06a3847fdd01fbbf67c84014c4e396f3"
        },
        {
          "path": "src/app/(identity)/cuenta/onboarding-guide.js",
          "sha256": "ef6d6c9ecbe942ec53df8b64610908533aebdbce0bc879d1a77218f26d83221c"
        },
        {
          "path": "src/app/(identity)/cuenta/onboarding-guide.module.css",
          "sha256": "12b7266039af5122e322ea712b9a54497bc5073eaa9037911760684d79c5dacc"
        },
        {
          "path": "src/app/(identity)/cuenta/operations-status-panel.js",
          "sha256": "e069565737378ca2583609a4b978d1ac6efdf9da922736b1bcf70d4674e84b5e"
        },
        {
          "path": "src/app/(identity)/cuenta/operations-status-panel.module.css",
          "sha256": "73d25fe9f75c2144aeb337dd0737c3cae3f07fb98c9acb39d6e6c88a4e6053ef"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-number-panel.js",
          "sha256": "d2146290e43adb77dc14b707787023a24ffe80c39e69eaa49fc876dcab3d267b"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-number-view.mjs",
          "sha256": "6940f11e30d2958d7f6771463ce28ca83c0e2d2f41e81aa220c8efe669580300"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-templates-panel.js",
          "sha256": "bf75e0cd2444493f07a90923ea73c4d0251e5cef0ab8516b8693cff395d5e91d"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-templates-view.mjs",
          "sha256": "3bf758b150336613a437e2b01d3b6a79645a024b771f1515f4ec2ae58a1b8bc3"
        },
        {
          "path": "src/app/(identity)/cuenta/page.js",
          "sha256": "eaa1eed27b9e3ff49a3b012b4eb50ed98ac9af90b183ae46129c96562b273667"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-account-discovery-format.mjs",
          "sha256": "3b9908b1a5e348dc7379a026f4e1d81942a7fa6b2b51e509fc5736586ed9fa1a"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-account-discovery.js",
          "sha256": "e53350614d51a51ba4f0d9b39a5a91bccd799fe65f3365d7746beb3fec3f6909"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-civil-data-panel.js",
          "sha256": "ea4a133fbf95065ca7a4a5ce2635cb60f80557d3f7f0c82e4129a68c42694807"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-civil-data-view.mjs",
          "sha256": "b475b011c2466d722ceecf64460b8b97eb5eedafd2fd873d5d8d97c889dcc1ff"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-kyc-capture.js",
          "sha256": "83ee427bbbecbf74aee901fd77c6981232a2cd07e235180566938c2c0201647d"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-kyc-capture.module.css",
          "sha256": "51b47533e4e6e1ce53038fc776fcd15f30e5893af472ccebd80f5e19d5e23f0f"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-kyc-chat-attempt-panel.js",
          "sha256": "153d39988f1b82e143e2c3c99b72ed0791687a70432246e16ae4c91c1fb395ee"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-kyc-chat-attempt-view.mjs",
          "sha256": "0a6aa93d1646bc7eedecf56b1dc84deb0b146f7386017eafa5affe255e40c52b"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-kyc-preanalysis-view.mjs",
          "sha256": "0e57a89f39f1ad3c0a00c27524d9c7b6a1b92d4610d7927c33f0afc791c63213"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-ocr-usage-view.mjs",
          "sha256": "29d3eecf963a9569cfc692f0f35f404c431b844d2e7f6476d62a38ad4c8ec2f9"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-office-account-view.mjs",
          "sha256": "f2716f72297a1277946bafa03a82d4c1fb7f2fcff7f4c4bbe155a86ed7e4e379"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-onboarding-next-step.mjs",
          "sha256": "18481bd2c61887a04321523aad36aa22c43406089e29f1450ff0874133a6d4ae"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-panel.js",
          "sha256": "a9d5934c7bda61c49362ac53cfb339a5d66497566f71415ecc4621686ce17519"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-panel.module.css",
          "sha256": "c1626d1a678f1060b1ccb9df106f32b041da2c3b2bd92ede3e65537aaf794c02"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline-panel.js",
          "sha256": "d2d4bb3d3129e30d9181ab56b297723e105bde52aef6be9f907914340638329d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline-view.mjs",
          "sha256": "0c696eba748a7441440e23be5085dc42d4954427def5adc1e2de686b4b11711d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline.module.css",
          "sha256": "e33df0e4af4217f0516fecf5efef8eefef4278522ccfe1f97a1ad76390441b60"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-calendar-suggestions.mjs",
          "sha256": "be73d51220557e395295700a238024d9896ef627a305718518214fc7bd227457"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-panel.js",
          "sha256": "19b79557ed1fa8d5db6d1a46201d925ea1ffc601cedb100da42bfe0768410dbf"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-panel.module.css",
          "sha256": "c64771e75e83b6708ede012f90636bac1d13c19a3c1088c685513e702cc69061"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-usage-view.mjs",
          "sha256": "666668e0267f77599f191ca5ffa038da11232ad8bb08806d2b46d9193994a186"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-measurement-panel.js",
          "sha256": "d9d1cd683a8aaf0ad1ea5656c03c12c00935c3653f54d9326196617b60039832"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-measurement-panel.module.css",
          "sha256": "8290affa492be1699acb568c2ee4c8c5c672b3f2b06e2917f541c72bdacbde3a"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-measurement-view.mjs",
          "sha256": "02a80449af709fdda97dfaf48b0335bd96ab7dc363804f59a5d9ea8579581d30"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-budget-preview.js",
          "sha256": "89868285a7cdd7a8e6f024d2e4924d45f3c811c7a24c4afe4655611f21998c15"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-budget-preview.mjs",
          "sha256": "b6f64911f619ca1f999a4fffbb26c97b94c85e33bc49bd251d55676dd63208fa"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-measurement-preview.js",
          "sha256": "e68aa0851e4d415408c21df76d3716c4e4196925223c155a96194d7db85566d8"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-measurement-preview.mjs",
          "sha256": "f30a1c21396f61a1808446d9660554132b5df654e633d128dfe2f76336a9adc5"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-source-preview.js",
          "sha256": "a37e9dc27ecc12271c1043d42ca2c3311f66cae7c3fdae6bf961f67bd639e431"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-source-preview.mjs",
          "sha256": "fcd3a41c62138e77fc026c6651a0a228d9f4507b0a87c82a3b113b0e4fc26e8d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-source-preview.module.css",
          "sha256": "301f578a68afa6878e67341f02a47b405444cea63eb6ae44eb86241b1c0da799"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.js",
          "sha256": "b0f1ef1fee082e82f18d4bd2fb13377b27d8f9849e831f2c34120164f93f9a12"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.mjs",
          "sha256": "689402d373744d159a62e2e5975ddfdf79053c528a838879dd5df3e43a0efdc9"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.module.css",
          "sha256": "92f94328baac3fb0416002db12b5c19923fc28e6f89cb625df10038e0a96a180"
        },
        {
          "path": "src/app/(identity)/cuenta/portfolio-overview-panel.js",
          "sha256": "91940070e73099386731e669d3f4059564b72d1ad82691434d64dcac17adc318"
        },
        {
          "path": "src/app/(identity)/cuenta/portfolio-overview-panel.module.css",
          "sha256": "af5230820ce3c994d93e2262bc676ae5e3d69ffa380a866095fb88d997527c8c"
        },
        {
          "path": "src/app/(identity)/cuenta/portfolio-overview-view.mjs",
          "sha256": "8446fc933db4a867235a61ffbafdbbd0bcdc94d97000d5990c795df9e884739e"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-panel.js",
          "sha256": "8c419e76293791fc441dc8685386d12498a3d3cca2938ae0cba0f7dc7c0c1180"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-panel.module.css",
          "sha256": "269dd7c7c5e43bc959ef80dd94e3ab1cfd42b96b02d9c648ab21c281329796db"
        },
        {
          "path": "src/app/(identity)/cuenta/private-workspace-download.js",
          "sha256": "d86399de71069a9ca9a1fb330692f87728bf44b8b0b59ca691d457357a0eddab"
        },
        {
          "path": "src/app/(identity)/cuenta/project-creation-format.mjs",
          "sha256": "7cef11fff2447564b56b253d2105c3589b100d8374e4633321be1b96e7e75d8f"
        },
        {
          "path": "src/app/(identity)/cuenta/project-creation-panel.js",
          "sha256": "5c0cec226b92fa2a59d1e03cb2aea489bf8016304a43bd6259e35fd45fef2d92"
        },
        {
          "path": "src/app/(identity)/cuenta/project-creation-panel.module.css",
          "sha256": "a111badb3ae7bd4c1189a19670d2096bef482c3789d01bd7400677f13dd46d06"
        },
        {
          "path": "src/app/(identity)/cuenta/project-preparation-format.mjs",
          "sha256": "7833eea1fd3b0c86733172c580b2d0178aa76cc3acae1a0b80e54e51dcb06a19"
        },
        {
          "path": "src/app/(identity)/cuenta/project-preparation-panel.js",
          "sha256": "a8d6086ce10a40c44b74e5472ee6f0a05946118014cfa93dfc4ceff4611dc2ac"
        },
        {
          "path": "src/app/(identity)/cuenta/project-preparation-panel.module.css",
          "sha256": "a7766d92df0049fa05ce4d28baf30c655bd8f268e6fbf3a8462ae2cda326ee64"
        },
        {
          "path": "src/app/(identity)/cuenta/schedule-workbench.js",
          "sha256": "b214b66dcd910728798a3084b5d3698296e458db67855f38bc820aaebee75d8c"
        },
        {
          "path": "src/app/(identity)/cuenta/schedule-workbench.mjs",
          "sha256": "12a01f0ec44b65b70ca50f5fabcba2483e964d87556dcf62db92c84d4c2ee022"
        },
        {
          "path": "src/app/(identity)/cuenta/schedule-workbench.module.css",
          "sha256": "6643a7082034e523d9aaa9ba23195634dbfdd7a37cdf0cb3b9f02cbd13f5e11b"
        },
        {
          "path": "src/app/(identity)/cuenta/session-recovery.js",
          "sha256": "166582cb087e6ffb16ef294605f97545b5c1cfc22835fa4a358c3584804fee0f"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-panel.js",
          "sha256": "398697fb4d8850ca7f0738fc93a3f17b4313e7afdbbe9e9d1a87e9b613bd0225"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-panel.module.css",
          "sha256": "3fe757c073165128724352333e73a04f6741ac70b4c59fc0d100af025c284f04"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-view.mjs",
          "sha256": "58ebd978e8e39423901cb811ecf2ab851160b78f7cd5cb441075d66d7819dee9"
        },
        {
          "path": "src/app/(identity)/cuenta/site-register-panel.js",
          "sha256": "e8c0c456e09e9da3432dcbf01c1f4659540a596112fe28946889ae369d08d76e"
        },
        {
          "path": "src/app/(identity)/cuenta/site-register-panel.module.css",
          "sha256": "7d86974d7db3279116895cde681e231f135fb1a86e7e8b52bf74e7bb965fd0e2"
        },
        {
          "path": "src/app/(identity)/cuenta/task-create-panel.js",
          "sha256": "3d4b8f9865cdfa73b1f8c3543c4c4400babc09fe56cd21083d0bb96035445bee"
        },
        {
          "path": "src/app/(identity)/cuenta/task-progress-measurement-editor.js",
          "sha256": "2e95b587d9b6f4bfa1beb1eacdba44c4db8a7220cb6584befc6b4de79bf11eac"
        },
        {
          "path": "src/app/(identity)/cuenta/task-progress-measurement-editor.module.css",
          "sha256": "ca9b2e0432724c74a194d2648ff8dd3e7814ff192046ec02ab9f23e31d778b79"
        },
        {
          "path": "src/app/(identity)/cuenta/task-progress-measurement-view.mjs",
          "sha256": "b4b1e2645a7b4b853ba84525692b4d73596ea5490a6c000bbe9d2555cc286634"
        },
        {
          "path": "src/app/(identity)/cuenta/template-send-panel.js",
          "sha256": "c2ed4900b2f842031b713ce1d859e69e23e6278ca012c4d7b6011058c5bdc2ea"
        },
        {
          "path": "src/app/(identity)/cuenta/template-send-panel.module.css",
          "sha256": "de30d752855458140928f677e00ada91b80ad7ba574b3183b62b3d45f1e5eb56"
        },
        {
          "path": "src/app/(identity)/cuenta/template-send-view.mjs",
          "sha256": "703415b8dab1a575ebb54c9273049d2b940f93994add7177255ae26918672940"
        },
        {
          "path": "src/app/(identity)/cuenta/voice-progress-draft-view.js",
          "sha256": "a21b205b409cbbf6321036b23bc8a873d5d32388f4bad883793278531cec8d9a"
        },
        {
          "path": "src/app/(identity)/cuenta/worker-channel-panel.js",
          "sha256": "7325f3b80c5737fd39a266d0c77de703ff5515177b8945ecfa33c5250213903d"
        },
        {
          "path": "src/app/(identity)/cuenta/worker-channel-panel.module.css",
          "sha256": "28d5e1754f9345073d9a34d737f4e8b89c2f2f04e610e85c285ba81ea4f6e9ff"
        },
        {
          "path": "src/app/(identity)/cuenta/worksite-task-selector.js",
          "sha256": "d790aeec929ed1ef2ac724883988b03f6640f3882133d917760f0ddeb2a2488c"
        },
        {
          "path": "src/app/(identity)/cuenta/worksite-task-selector.module.css",
          "sha256": "12351228e827ea0e9a42a45f4d40a3fb713edd01bf0aab3ab6f58efbde7fa434"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-client.js",
          "sha256": "300e6c7f293ecc102b313c395d6e23fb520618435cf7cf5fe78e8c333e9f7cf8"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-identity.js",
          "sha256": "c3867723ef4ef76a38dd52d19be76f2d78752e49110c8c36648130452879c8c2"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-read.mjs",
          "sha256": "a73e558f46b86a78cbe4f22783403af17061fe03e79f8e184f967448041909ec"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
          "sha256": "a61c2d017bc8dadb79fab4b0630b0404b65132d355e153bcb6a2042f5fd49511"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-refresh.js",
          "sha256": "78b056667e89f56fd9e1185c3addc6a8d40b331a0cd82146cbba17771662510a"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-overview.js",
          "sha256": "b895bbe6bd6a0186f8600edd7e335b2239dc6f05c43f6c7c514a02a1a6964fc2"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
          "sha256": "3a8d1c517fb084df425198c84671f6b76bb1f659f9d0d4ed94945cd1046d8e64"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-panel.js",
          "sha256": "063361bf78293a61a246195d5734f69a17b08c5781ae5c9f502b85dcc51ef883"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
          "sha256": "d8cf1e7e8d88d66f722aaf52deb45f95829c226468d3f37a2b23d171cc1ecbb8"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
          "sha256": "b3004538de2cc7cbc829bf5518c4f4b2a5eb2935d0b4e60f9c88840c8ede3797"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
          "sha256": "590cd7691d8b6beb82929bdd18dd9909c2d2cfa1c3d4111ff4d478d57daf532f"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-screen.js",
          "sha256": "b5c217095badf8db73842b98d86b6ae498da9f01b793ccda3683dc46be040b4a"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-session-request.mjs",
          "sha256": "29d294ac1d973317d6a3df225a64a8a9115c6ea51c587f297114e7992af97520"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-task-page.mjs",
          "sha256": "9dde484ab352b4d64d0301e735ae511d7a75ef9633439e77558dd273de1d9aa6"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-tools-navigation.js",
          "sha256": "6e3bc5b9d14973153e080a55ba55a51f1c36838641c8510af4f2f664e676ddc9"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-tools-navigation.module.css",
          "sha256": "25e6e54bc34821a658490e0276f92aae48675fdcca8f9a4b563acb49b81d5b06"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-view-routing.mjs",
          "sha256": "d02f2d11ec5ce4a1419ed79c9639cdad40174c236382853778fc984f071e4df4"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace.module.css",
          "sha256": "dfce6eb468fee571af0d0f371e68848274f22198faf89c0a6cdd5df5edc7e7a9"
        },
        {
          "path": "src/app/(identity)/identity-load-guard.js",
          "sha256": "7fcc70f299551b2ba8aa13394b55139832f93630d93dd8f54630d58a86464543"
        },
        {
          "path": "src/app/(identity)/identity.module.css",
          "sha256": "3b8b7d36f1f52eff3329a22b8e1ad9708d865360cff10d75641fcf0a986030ce"
        },
        {
          "path": "src/app/brand/brand-geometry.js",
          "sha256": "73c97fb1bba20ee373c59971d7207122020557192acebd33192774e9724fcaf6"
        },
        {
          "path": "src/app/brand/brand-logo.js",
          "sha256": "2218b0d3551de28698c2dc56507d5d744cb19ccdfc78260d0c08e375face9d3b"
        },
        {
          "path": "src/app/brand/brand-logo.module.css",
          "sha256": "94bc6e069d56c477b4dd0e46d894217f411afc375267afd707af962ab5ce6ea3"
        },
        {
          "path": "src/lib/company-entitlement.mjs",
          "sha256": "65d41dfb796ef12be38b1220a99ccd3dfe277419a5e5a27e125beb29fe7e2cde"
        },
        {
          "path": "src/lib/company-phone-format.mjs",
          "sha256": "67b31114f517253961c6a774210f157867b1e2e318e6b700089eef03ef1b7209"
        },
        {
          "path": "src/lib/field-media-privacy.mjs",
          "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
        },
        {
          "path": "src/lib/geo.js",
          "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
        },
        {
          "path": "src/lib/identity-return-path.mjs",
          "sha256": "91f04f80b1a2dbc7d56b8dd4b532c0540d643c2b8f48cebc25c8fcbee8ab9cf0"
        },
        {
          "path": "src/lib/participant-analysis-consent.mjs",
          "sha256": "7f7d371914d1e46ac799cd1683afdc0418186c15a20156e697ecd879c81bf8c1"
        },
        {
          "path": "src/lib/participant-approved-identity.mjs",
          "sha256": "834d81e70cedbd967ff84d880ea9d697c2168d2220fb23d9eb14c1aba1cdbbf1"
        },
        {
          "path": "src/lib/participant-bank-format.mjs",
          "sha256": "ebbb206a14eaac57230b53ec1afae99c4be60c8739baf0d1d047d4a47ba464db"
        },
        {
          "path": "src/lib/participant-kyc-image-set.mjs",
          "sha256": "190ce2560286a58d42668da7b912aeabcfa76ee14086503bf1609304e5f0e8fb"
        },
        {
          "path": "src/lib/participant-onboarding-policy.mjs",
          "sha256": "59409797ce3e13b7cfe63fe21d8d7e2c848ee49e0766015939242a9f43687c03"
        },
        {
          "path": "src/lib/participant-policy.mjs",
          "sha256": "7f3969ab1ebac5f01696149d76337199eb64c2fd09015c44c07e8b7e7088d62f"
        },
        {
          "path": "src/lib/participant-verified-office.mjs",
          "sha256": "4922f392490aa6d49b8a8a45a56ac0b03831a8ad2efe89ce1e3adfd77d603d89"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/private-image-upload.mjs",
          "sha256": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60"
        },
        {
          "path": "src/lib/production-identity-config.mjs",
          "sha256": "3738a8544a7e26af4f03befe9afd0dee3ec70ae0e8c89d456dd81a1b87dfdee1"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/session-recovery.mjs",
          "sha256": "a44cf530faefa0fd74961d30993897f24f9e929237c01d0ebde4badd6c90ba07"
        },
        {
          "path": "src/lib/site-register-policy.mjs",
          "sha256": "d529c4f2225e0ec851ef7df60f8c5b182a88b384958ebfd15b194683d1590434"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/verified-session.mjs",
          "sha256": "744fe1ebe8c250aee7bf5e7ff1c07c89b37b42dd9f6ada29b82258995fdd296d"
        },
        {
          "path": "src/lib/voice-progress-draft.mjs",
          "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
        },
        {
          "path": "src/lib/whatsapp/tenant-workspace-policy.js",
          "sha256": "d3416ff993fbfd70f75404166cdcd8f0b9b2e5a6741f6cde03725aab16abcd5e"
        },
        {
          "path": "src/lib/workspace-policy.mjs",
          "sha256": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e"
        },
        {
          "path": "tests/fixtures/integrated-identity-contract-27aa.json",
          "sha256": "3c1a184f2e6839bba6bd7116ccf6c062fbb015500ec4900583dbd15f82fe7270"
        },
        {
          "path": "tests/fixtures/plan-measurement-contract-a203.json",
          "sha256": "10319b1ab8a283b7c89cab96a279e20e25fe4be2736d91caaa915a4e62afa524"
        },
        {
          "path": "tests/fixtures/whatsapp-field-continuity-contract-052.json",
          "sha256": "f7a72979af7b789d92333d4f631d6bbbccf247c5c04ce6edd88f64f70b6099bb"
        },
        {
          "path": "tests/fixtures/workspace-continuity-contract-d5d.json",
          "sha256": "8c2afc33e9454b9c7a9d9fd2056f2c3de75f4657bbcbce4fb1bdf618e0590db3"
        },
        {
          "path": "tests/production-company-bootstrap-receipt.test.mjs",
          "sha256": "44676be514b092d8146f6f8ade5c4b0867f8bceb1b9f5c7ab204bb5f90e503af"
        },
        {
          "path": "tests/production-focused-workspace-ci.test.mjs",
          "sha256": "0319f722df958e9928d9ec8d27819f7e482cf66bc3c565c6743ced30f016921e"
        },
        {
          "path": "tests/production-focused-workspace-continuity-ui.test.mjs",
          "sha256": "d545f4361f513e3b1c7a3b3ca9db5bd6d12be0ae74b3df327880fb9954649a8d"
        },
        {
          "path": "tests/production-focused-workspace-navigation.test.mjs",
          "sha256": "5f6614ed798d02be2b99de9267c2766ec61e8d1b4d46c3fefed3aa69832bde7e"
        },
        {
          "path": "tests/production-focused-workspace-task-pagination.test.mjs",
          "sha256": "5afbb67627d790d41df2d9cde0270dcafe93ab5292d822c9a45534203acaed34"
        },
        {
          "path": "tests/production-focused-workspace-ui.test.mjs",
          "sha256": "70ae514cae438c367c30407b083c68121a9496323fe877a4c874f432bd7447ac"
        },
        {
          "path": "tests/production-integrated-identity-current-ci-lineage.test.mjs",
          "sha256": "f9d99f05fa5dceacba18bc7168ce39d05de7bfd795cb3960ec8eacf4b80372c4"
        }
      ]
    },
    {
      "family": "UI_FIELD_TASK_PAGINATION",
      "previousFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/field-outbound-current-ci-lineage.mjs",
        "scripts/lib/home-decisions-current-ci-lineage.mjs",
        "scripts/lib/integrated-identity-current-ci-lineage.mjs",
        "scripts/lib/kyc-expired-current-ci-lineage.mjs",
        "scripts/lib/material-review-current-ci-lineage.mjs",
        "scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs",
        "scripts/lib/ooxml-accounting-current-ci-lineage.mjs",
        "scripts/lib/owned-fixture-cleanup.mjs",
        "scripts/lib/participant-preanalysis-current-ci-lineage.mjs",
        "scripts/lib/plan-measurement-current-ci-lineage.mjs",
        "scripts/lib/plan-measurement-document-association-ci-lineage.mjs",
        "scripts/lib/plan-partida-preview-current-ci-lineage.mjs",
        "scripts/lib/plan-partida-preview-current-ci-reviewed.mjs",
        "scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs",
        "scripts/lib/worksite-live-hours-current-ci-lineage.mjs",
        "scripts/lib/worksite-live-hours-current-ci-reviewed.mjs",
        "scripts/lib/workspace-continuity-current-ci-lineage.mjs",
        "scripts/verify-field-task-pagination-ci.mjs",
        "scripts/verify-field-task-pagination-ui.mjs",
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/field-hours-report-panel.js",
        "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
        "src/app/(identity)/cuenta/field-media-capture.js",
        "src/app/(identity)/cuenta/field-media-held-view.mjs",
        "src/app/(identity)/cuenta/field-media-preparation.mjs",
        "src/app/(identity)/cuenta/field-media-preview.js",
        "src/app/(identity)/cuenta/field-operations-panel.js",
        "src/app/(identity)/cuenta/field-operations-panel.module.css",
        "src/app/(identity)/cuenta/field-overtime-view.js",
        "src/app/(identity)/cuenta/field-overtime-view.module.css",
        "src/app/(identity)/cuenta/field-qr-capture.js",
        "src/app/(identity)/cuenta/field-qr-reader.mjs",
        "src/app/(identity)/cuenta/field-review-page-view.mjs",
        "src/app/(identity)/cuenta/material-inventory-panel.js",
        "src/app/(identity)/cuenta/material-inventory-panel.module.css",
        "src/app/(identity)/cuenta/material-inventory-view.mjs",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/private-workspace-download.js",
        "src/app/(identity)/cuenta/schedule-workbench.mjs",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/task-progress-measurement-view.mjs",
        "src/app/(identity)/cuenta/voice-progress-draft-view.js",
        "src/app/(identity)/cuenta/worksite-task-selector.js",
        "src/app/(identity)/cuenta/worksite-task-selector.module.css",
        "src/app/(identity)/cuenta/workspace-live-read.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh.js",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/app/(identity)/cuenta/workspace-task-page.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/geo.js",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/task-progress-measurement.js",
        "src/lib/voice-progress-draft.mjs",
        "tests/fixtures/integrated-identity-contract-27aa.json",
        "tests/fixtures/plan-measurement-contract-a203.json",
        "tests/fixtures/whatsapp-field-continuity-contract-052.json",
        "tests/fixtures/workspace-continuity-contract-d5d.json",
        "tests/production-field-task-pagination-ci.test.mjs",
        "tests/production-whatsapp-field-continuity-current-ci-lineage.test.mjs",
        "tests/production-worksite-task-selector.test.mjs",
        "tests/production-workspace-task-page.test.mjs"
      ],
      "previousExternalImports": [
        "@babel/parser",
        "jsqr",
        "next/dist/build/swc/index.js",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:net",
        "node:path",
        "node:test",
        "node:timers/promises",
        "node:url",
        "node:zlib",
        "puppeteer",
        "react",
        "react-dom/server"
      ],
      "currentFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/field-outbound-current-ci-lineage.mjs",
        "scripts/lib/home-decisions-current-ci-lineage.mjs",
        "scripts/lib/integrated-identity-current-ci-lineage.mjs",
        "scripts/lib/kyc-expired-current-ci-lineage.mjs",
        "scripts/lib/material-review-current-ci-lineage.mjs",
        "scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs",
        "scripts/lib/ooxml-accounting-current-ci-lineage.mjs",
        "scripts/lib/owned-fixture-cleanup.mjs",
        "scripts/lib/participant-preanalysis-current-ci-lineage.mjs",
        "scripts/lib/plan-budget-current-ci-lineage.mjs",
        "scripts/lib/plan-budget-current-ci-reviewed.mjs",
        "scripts/lib/plan-measurement-current-ci-lineage.mjs",
        "scripts/lib/plan-measurement-document-association-ci-lineage.mjs",
        "scripts/lib/plan-partida-preview-current-ci-lineage.mjs",
        "scripts/lib/plan-partida-preview-current-ci-reviewed.mjs",
        "scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs",
        "scripts/lib/worksite-live-hours-current-ci-lineage.mjs",
        "scripts/lib/worksite-live-hours-current-ci-reviewed.mjs",
        "scripts/lib/workspace-continuity-current-ci-lineage.mjs",
        "scripts/verify-field-task-pagination-ci.mjs",
        "scripts/verify-field-task-pagination-ui.mjs",
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/field-hours-report-panel.js",
        "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
        "src/app/(identity)/cuenta/field-media-capture.js",
        "src/app/(identity)/cuenta/field-media-held-view.mjs",
        "src/app/(identity)/cuenta/field-media-preparation.mjs",
        "src/app/(identity)/cuenta/field-media-preview.js",
        "src/app/(identity)/cuenta/field-operations-panel.js",
        "src/app/(identity)/cuenta/field-operations-panel.module.css",
        "src/app/(identity)/cuenta/field-overtime-view.js",
        "src/app/(identity)/cuenta/field-overtime-view.module.css",
        "src/app/(identity)/cuenta/field-qr-capture.js",
        "src/app/(identity)/cuenta/field-qr-reader.mjs",
        "src/app/(identity)/cuenta/field-review-page-view.mjs",
        "src/app/(identity)/cuenta/material-inventory-panel.js",
        "src/app/(identity)/cuenta/material-inventory-panel.module.css",
        "src/app/(identity)/cuenta/material-inventory-view.mjs",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/private-workspace-download.js",
        "src/app/(identity)/cuenta/schedule-workbench.mjs",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/task-progress-measurement-view.mjs",
        "src/app/(identity)/cuenta/voice-progress-draft-view.js",
        "src/app/(identity)/cuenta/worksite-task-selector.js",
        "src/app/(identity)/cuenta/worksite-task-selector.module.css",
        "src/app/(identity)/cuenta/workspace-live-read.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh.js",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/app/(identity)/cuenta/workspace-task-page.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/geo.js",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/task-progress-measurement.js",
        "src/lib/voice-progress-draft.mjs",
        "tests/fixtures/integrated-identity-contract-27aa.json",
        "tests/fixtures/plan-measurement-contract-a203.json",
        "tests/fixtures/whatsapp-field-continuity-contract-052.json",
        "tests/fixtures/workspace-continuity-contract-d5d.json",
        "tests/production-field-task-pagination-ci.test.mjs",
        "tests/production-whatsapp-field-continuity-current-ci-lineage.test.mjs",
        "tests/production-worksite-task-selector.test.mjs",
        "tests/production-workspace-task-page.test.mjs"
      ],
      "externalImports": [
        "@babel/parser",
        "jsqr",
        "next/dist/build/swc/index.js",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:net",
        "node:path",
        "node:test",
        "node:timers/promises",
        "node:url",
        "node:zlib",
        "puppeteer",
        "react",
        "react-dom/server"
      ],
      "currentManifest": [
        {
          "path": "package-lock.json",
          "sha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449"
        },
        {
          "path": "package.json",
          "sha256": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d"
        },
        {
          "path": "scripts/lib/field-outbound-current-ci-lineage.mjs",
          "sha256": "7801d9d074c4451178d7900d605aa75c91ebf6b4a82a24f997e89d0284008c7b"
        },
        {
          "path": "scripts/lib/home-decisions-current-ci-lineage.mjs",
          "sha256": "bd61edf4351e0d3b8f7857cb26cdc169162dca5400467f2f9fbfbd5853903503"
        },
        {
          "path": "scripts/lib/integrated-identity-current-ci-lineage.mjs",
          "sha256": "aaf23ee0e97231520f29669136d969ffc513bd6b52067df751d3dc6cf9c86bb8"
        },
        {
          "path": "scripts/lib/kyc-expired-current-ci-lineage.mjs",
          "sha256": "5077fde271911fa020e7751bfb27d20fbf3f07f10d6069c482c8739d2c3026ef"
        },
        {
          "path": "scripts/lib/material-review-current-ci-lineage.mjs",
          "sha256": "54bafcc5ec399197f2b3b22e6dcf2f0aa31ff18f0d2727688954533f8dc4ecc7"
        },
        {
          "path": "scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs",
          "sha256": "93763476c4dc0b193cf1e4d174f7eae71c0daf1081827d18d21cc7ee22f7d586"
        },
        {
          "path": "scripts/lib/ooxml-accounting-current-ci-lineage.mjs",
          "sha256": "481bd570fe9eb6b08db6568e830e5c74f4d07a3e0eebff9f95c4abc541db9681"
        },
        {
          "path": "scripts/lib/owned-fixture-cleanup.mjs",
          "sha256": "44a9df241dd8426fe8d148b1b33110fe1e103960814e81f1f9a41638d8613844"
        },
        {
          "path": "scripts/lib/participant-preanalysis-current-ci-lineage.mjs",
          "sha256": "3c330d4f821d7f2c998dd17064c67ffdcc52dc3cfbd033c165af39e071333f7b"
        },
        {
          "path": "scripts/lib/plan-budget-current-ci-lineage.mjs",
          "sha256": "834a40911ef64844f0db441a48cef5de235ae556c301308a62ff347f7106d678"
        },
        {
          "path": "scripts/lib/plan-budget-current-ci-reviewed.mjs",
          "sha256": "REVIEWED_DECLARATION_TRUST_ANCHOR"
        },
        {
          "path": "scripts/lib/plan-measurement-current-ci-lineage.mjs",
          "sha256": "d8fb88fffd808ba4fa0ceeb561a8224589adf1f01a4258ee896d8a94dd3e93c9"
        },
        {
          "path": "scripts/lib/plan-measurement-document-association-ci-lineage.mjs",
          "sha256": "0a14f5211348d30d3a16b441a126880aeed8c7e196973ecceda7ee00307f0ef4"
        },
        {
          "path": "scripts/lib/plan-partida-preview-current-ci-lineage.mjs",
          "sha256": "141f5d6decf74d9dc126399ac955ac27874da785fd6c5df5f8af7bc0244d4e75"
        },
        {
          "path": "scripts/lib/plan-partida-preview-current-ci-reviewed.mjs",
          "sha256": "f908107cd26280c1b8e1001d9aeb5bc00107c0d7b39feb9b7ec2c1d539aa3e04"
        },
        {
          "path": "scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs",
          "sha256": "a1de3a73617de7c4eb2f9db8665650abe5798accb44b886cd8d2220fe5295bbf"
        },
        {
          "path": "scripts/lib/worksite-live-hours-current-ci-lineage.mjs",
          "sha256": "c78c0792ec6c9142b76090bdffc65fc026a5b333a473e833a203981bec96f448"
        },
        {
          "path": "scripts/lib/worksite-live-hours-current-ci-reviewed.mjs",
          "sha256": "8da86cb1eeb978e37843d4f722da44968e4a089fd719aa35ebd966395f784758"
        },
        {
          "path": "scripts/lib/workspace-continuity-current-ci-lineage.mjs",
          "sha256": "cb26d5ea9922fb9a3fb72d1a35010229a1d4b49f4784783294a4d1d503fdc81a"
        },
        {
          "path": "scripts/verify-field-task-pagination-ci.mjs",
          "sha256": "1e366a583be909323327524a8fe04db9eb962724ec5073bdf3eb36140ddcdecc"
        },
        {
          "path": "scripts/verify-field-task-pagination-ui.mjs",
          "sha256": "4b98ee409dfca7fa78ffac58c82796c9013f34286691e19e4993149ffd0ad604"
        },
        {
          "path": "src/app/(identity)/cuenta/company-channel-view.mjs",
          "sha256": "c79c473999e444b84e2a1d58e0d03f030069c24f9749f2c84450318b0b237e4d"
        },
        {
          "path": "src/app/(identity)/cuenta/field-hours-report-panel.js",
          "sha256": "d91074b8b1693c95dcf80a86fc73711fbd98a7ba482251ade68fd227166fb748"
        },
        {
          "path": "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
          "sha256": "0c8eefb85891cade983a42b7f4463962319c9fe27c0c5d157011108255c2bd75"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-capture.js",
          "sha256": "f8019225870bc6ccf04818ad7ff305798d53ea9b523400385816ba7fe2117559"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-held-view.mjs",
          "sha256": "cfc01204f973281e77a49627c7c5e32c6bdd04a1bc4c6e0a9e93773eca4faf71"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-preparation.mjs",
          "sha256": "df03121d9a7beb6b4a77946cefb09ce00710a6e22b5c8b680b180dd5a2e64a6f"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-preview.js",
          "sha256": "61506157217af690aa3ea649a2472f99acc24ec96aa10eda3cc25d24a8108441"
        },
        {
          "path": "src/app/(identity)/cuenta/field-operations-panel.js",
          "sha256": "5477d459da2e68688ce3bcf68f8f928ab0a4155144696abb2736f0c511fcd455"
        },
        {
          "path": "src/app/(identity)/cuenta/field-operations-panel.module.css",
          "sha256": "5ccd8b5beae691b9ab6ee2dc0c0ae876a5fdffe15d31d24c6807f117bd76949c"
        },
        {
          "path": "src/app/(identity)/cuenta/field-overtime-view.js",
          "sha256": "161a09cb92b09695c4007cf99c3c7755586bf8e05d7f93e147fe9f1bfb45ca60"
        },
        {
          "path": "src/app/(identity)/cuenta/field-overtime-view.module.css",
          "sha256": "e7f9e4ff4216fdb18b333d0b8cd40a5b3158e5f2e398f6207ab5cea2789fcf7a"
        },
        {
          "path": "src/app/(identity)/cuenta/field-qr-capture.js",
          "sha256": "3bc42cb87ec6554a9ac6001b199f434f087e4156139d76428d1ebaf43d12e37d"
        },
        {
          "path": "src/app/(identity)/cuenta/field-qr-reader.mjs",
          "sha256": "04157b9fc7a197271bac76d41217db8876b42dc6fbc6cb068a7052d2ea2b5b31"
        },
        {
          "path": "src/app/(identity)/cuenta/field-review-page-view.mjs",
          "sha256": "a1187150e0a3344666418b0191a898a6cf019ad2e8e5c46be2be721aee969634"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-panel.js",
          "sha256": "f910384fa3acc4326037b4a4b0c141c1712cb95845f14d8d975705463fecd2e2"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-panel.module.css",
          "sha256": "1d7eec4afc275ee403674b187acb7844e3df519f24cd537af2e05f7b8032611c"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-view.mjs",
          "sha256": "8942cb9a2f3ed071a77a9e87ca3876fa16b1f819bcb74f395e4307f7c167605a"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-number-view.mjs",
          "sha256": "6940f11e30d2958d7f6771463ce28ca83c0e2d2f41e81aa220c8efe669580300"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-templates-view.mjs",
          "sha256": "3bf758b150336613a437e2b01d3b6a79645a024b771f1515f4ec2ae58a1b8bc3"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-office-account-view.mjs",
          "sha256": "f2716f72297a1277946bafa03a82d4c1fb7f2fcff7f4c4bbe155a86ed7e4e379"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline-view.mjs",
          "sha256": "0c696eba748a7441440e23be5085dc42d4954427def5adc1e2de686b4b11711d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.mjs",
          "sha256": "689402d373744d159a62e2e5975ddfdf79053c528a838879dd5df3e43a0efdc9"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/app/(identity)/cuenta/private-workspace-download.js",
          "sha256": "d86399de71069a9ca9a1fb330692f87728bf44b8b0b59ca691d457357a0eddab"
        },
        {
          "path": "src/app/(identity)/cuenta/schedule-workbench.mjs",
          "sha256": "12a01f0ec44b65b70ca50f5fabcba2483e964d87556dcf62db92c84d4c2ee022"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-view.mjs",
          "sha256": "58ebd978e8e39423901cb811ecf2ab851160b78f7cd5cb441075d66d7819dee9"
        },
        {
          "path": "src/app/(identity)/cuenta/task-progress-measurement-view.mjs",
          "sha256": "b4b1e2645a7b4b853ba84525692b4d73596ea5490a6c000bbe9d2555cc286634"
        },
        {
          "path": "src/app/(identity)/cuenta/voice-progress-draft-view.js",
          "sha256": "a21b205b409cbbf6321036b23bc8a873d5d32388f4bad883793278531cec8d9a"
        },
        {
          "path": "src/app/(identity)/cuenta/worksite-task-selector.js",
          "sha256": "d790aeec929ed1ef2ac724883988b03f6640f3882133d917760f0ddeb2a2488c"
        },
        {
          "path": "src/app/(identity)/cuenta/worksite-task-selector.module.css",
          "sha256": "12351228e827ea0e9a42a45f4d40a3fb713edd01bf0aab3ab6f58efbde7fa434"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-read.mjs",
          "sha256": "a73e558f46b86a78cbe4f22783403af17061fe03e79f8e184f967448041909ec"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
          "sha256": "a61c2d017bc8dadb79fab4b0630b0404b65132d355e153bcb6a2042f5fd49511"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-refresh.js",
          "sha256": "78b056667e89f56fd9e1185c3addc6a8d40b331a0cd82146cbba17771662510a"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
          "sha256": "3a8d1c517fb084df425198c84671f6b76bb1f659f9d0d4ed94945cd1046d8e64"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
          "sha256": "d8cf1e7e8d88d66f722aaf52deb45f95829c226468d3f37a2b23d171cc1ecbb8"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
          "sha256": "b3004538de2cc7cbc829bf5518c4f4b2a5eb2935d0b4e60f9c88840c8ede3797"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
          "sha256": "590cd7691d8b6beb82929bdd18dd9909c2d2cfa1c3d4111ff4d478d57daf532f"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-session-request.mjs",
          "sha256": "29d294ac1d973317d6a3df225a64a8a9115c6ea51c587f297114e7992af97520"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-task-page.mjs",
          "sha256": "9dde484ab352b4d64d0301e735ae511d7a75ef9633439e77558dd273de1d9aa6"
        },
        {
          "path": "src/lib/field-media-privacy.mjs",
          "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
        },
        {
          "path": "src/lib/geo.js",
          "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/voice-progress-draft.mjs",
          "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
        },
        {
          "path": "tests/fixtures/integrated-identity-contract-27aa.json",
          "sha256": "3c1a184f2e6839bba6bd7116ccf6c062fbb015500ec4900583dbd15f82fe7270"
        },
        {
          "path": "tests/fixtures/plan-measurement-contract-a203.json",
          "sha256": "10319b1ab8a283b7c89cab96a279e20e25fe4be2736d91caaa915a4e62afa524"
        },
        {
          "path": "tests/fixtures/whatsapp-field-continuity-contract-052.json",
          "sha256": "f7a72979af7b789d92333d4f631d6bbbccf247c5c04ce6edd88f64f70b6099bb"
        },
        {
          "path": "tests/fixtures/workspace-continuity-contract-d5d.json",
          "sha256": "8c2afc33e9454b9c7a9d9fd2056f2c3de75f4657bbcbce4fb1bdf618e0590db3"
        },
        {
          "path": "tests/production-field-task-pagination-ci.test.mjs",
          "sha256": "0d8abfb43c696a007bbc676d8472599b24cc3d7edb465419f992d9811f988999"
        },
        {
          "path": "tests/production-whatsapp-field-continuity-current-ci-lineage.test.mjs",
          "sha256": "a0e817f4f0ea3bae2a8042447a38ad099fb448a9ec8d34c0fd8e0b754685a497"
        },
        {
          "path": "tests/production-worksite-task-selector.test.mjs",
          "sha256": "15d764467be94b0f84cc0988d969458ee52660d6f1d2f4c7c5cb96d5d9125a7f"
        },
        {
          "path": "tests/production-workspace-task-page.test.mjs",
          "sha256": "9bed3622f630c43c4069ce8cb0a8c4fa6a42a262a6550cc0f9e6ef83220e3fb6"
        }
      ]
    },
    {
      "family": "PLAN_MEASUREMENT",
      "previousFiles": [
        "scripts/fixtures/canonical-participant-kyc.mjs",
        "scripts/lib/company-channel-disposable-fixture.mjs",
        "scripts/lib/disposable-postgres-cleanup.mjs",
        "scripts/verify-plan-measurement-postgres.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/lib/bindx-civil-data-client.mjs",
        "src/lib/brand-assets.mjs",
        "src/lib/canonical-invited-account.mjs",
        "src/lib/company-channel-connection.mjs",
        "src/lib/company-channel-kyc.mjs",
        "src/lib/company-channel-routing.mjs",
        "src/lib/company-channel-schema.mjs",
        "src/lib/company-entitlement.mjs",
        "src/lib/company-onboarding-policy.mjs",
        "src/lib/company-phone-format.mjs",
        "src/lib/employee-intake-channel-continuity.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/legacy-access-boundary.js",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-callback-diagnostics.mjs",
        "src/lib/meta-channel-binding.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/meta-customer-app-projection.mjs",
        "src/lib/meta-customer-callback.mjs",
        "src/lib/meta-customer-coexistence.mjs",
        "src/lib/meta-customer-credentials.mjs",
        "src/lib/meta-customer-inbox-review.mjs",
        "src/lib/meta-customer-outbound.mjs",
        "src/lib/meta-customer-permissions.mjs",
        "src/lib/meta-customer-processing.mjs",
        "src/lib/meta-customer-provider.mjs",
        "src/lib/meta-customer-templates.mjs",
        "src/lib/meta-development-pilot-policy.mjs",
        "src/lib/meta-employee-intake.mjs",
        "src/lib/meta-field-bridge.mjs",
        "src/lib/meta-field-conversation.mjs",
        "src/lib/meta-kyc-challenge.mjs",
        "src/lib/meta-kyc-conversation.mjs",
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/meta-kyc-identity.mjs",
        "src/lib/meta-kyc-rejection-policy.mjs",
        "src/lib/meta-kyc-rejection.mjs",
        "src/lib/meta-own-company-policy.mjs",
        "src/lib/meta-plan-import-conversation.mjs",
        "src/lib/meta-plan-import-origin.mjs",
        "src/lib/meta-plan-import-transport.mjs",
        "src/lib/meta-test-recipient-binding.mjs",
        "src/lib/meta-whatsapp-transport.mjs",
        "src/lib/organization-resource-usage-policy.mjs",
        "src/lib/organization-usage-policy.mjs",
        "src/lib/participant-account-discovery.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-bank-account.mjs",
        "src/lib/participant-bank-format.mjs",
        "src/lib/participant-bank-vault.mjs",
        "src/lib/participant-channel-kyc.mjs",
        "src/lib/participant-civil-policy.mjs",
        "src/lib/participant-civil-store.mjs",
        "src/lib/participant-kyc-chat-attempt.mjs",
        "src/lib/participant-kyc-chat-closure.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/participant-kyc-notice-links.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs",
        "src/lib/participant-onboarding-authority.mjs",
        "src/lib/participant-onboarding-current-kyc.mjs",
        "src/lib/participant-onboarding-delivery.mjs",
        "src/lib/participant-onboarding-intent.mjs",
        "src/lib/participant-onboarding-policy.mjs",
        "src/lib/participant-onboarding-reactive.mjs",
        "src/lib/participant-policy.mjs",
        "src/lib/participant-store.mjs",
        "src/lib/participant-verified-office.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/pilot-media.mjs",
        "src/lib/plan-baseline-policy.mjs",
        "src/lib/plan-import-analyzer.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/plan-import-monthly-curve.mjs",
        "src/lib/plan-import-ooxml.mjs",
        "src/lib/plan-import-policy.mjs",
        "src/lib/plan-import-store.mjs",
        "src/lib/plan-measurement-configuration.mjs",
        "src/lib/plan-measurement-policy.mjs",
        "src/lib/plan-measurement-source.mjs",
        "src/lib/plan-measurement-store.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/whatsapp/field-worker-intent-policy.js",
        "src/lib/whatsapp/obra-intent-policy.js",
        "src/lib/whatsapp/operational-proposal-decision-policy.js",
        "src/lib/whatsapp/project-workspace-profile.js",
        "src/lib/whatsapp/template-review-policy.js",
        "src/lib/whatsapp/tenant-workspace-policy.js",
        "src/lib/worker-channel-consent-policy.mjs",
        "src/lib/worker-channel-identity.mjs",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-store.mjs",
        "tests/fixtures/plan-import-ooxml-synthetic.mjs",
        "tests/fixtures/plan-measurement-source-synthetic.mjs"
      ],
      "previousExternalImports": [
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "node:zlib",
        "pg",
        "saxes",
        "yauzl"
      ],
      "currentFiles": [
        "scripts/fixtures/canonical-participant-kyc.mjs",
        "scripts/lib/company-channel-disposable-fixture.mjs",
        "scripts/lib/disposable-postgres-cleanup.mjs",
        "scripts/verify-plan-measurement-postgres.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/lib/bindx-civil-data-client.mjs",
        "src/lib/brand-assets.mjs",
        "src/lib/canonical-invited-account.mjs",
        "src/lib/company-channel-connection.mjs",
        "src/lib/company-channel-kyc.mjs",
        "src/lib/company-channel-routing.mjs",
        "src/lib/company-channel-schema.mjs",
        "src/lib/company-entitlement.mjs",
        "src/lib/company-onboarding-policy.mjs",
        "src/lib/company-phone-format.mjs",
        "src/lib/employee-intake-channel-continuity.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/legacy-access-boundary.js",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-callback-diagnostics.mjs",
        "src/lib/meta-channel-binding.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/meta-consumption-evidence-catalog.mjs",
        "src/lib/meta-customer-app-projection.mjs",
        "src/lib/meta-customer-callback.mjs",
        "src/lib/meta-customer-coexistence.mjs",
        "src/lib/meta-customer-credentials.mjs",
        "src/lib/meta-customer-inbox-review.mjs",
        "src/lib/meta-customer-outbound.mjs",
        "src/lib/meta-customer-permissions.mjs",
        "src/lib/meta-customer-processing.mjs",
        "src/lib/meta-customer-provider.mjs",
        "src/lib/meta-customer-templates.mjs",
        "src/lib/meta-development-pilot-policy.mjs",
        "src/lib/meta-employee-intake.mjs",
        "src/lib/meta-field-bridge.mjs",
        "src/lib/meta-field-conversation.mjs",
        "src/lib/meta-kyc-challenge.mjs",
        "src/lib/meta-kyc-conversation.mjs",
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/meta-kyc-identity.mjs",
        "src/lib/meta-kyc-rejection-policy.mjs",
        "src/lib/meta-kyc-rejection.mjs",
        "src/lib/meta-own-company-policy.mjs",
        "src/lib/meta-plan-import-conversation.mjs",
        "src/lib/meta-plan-import-origin.mjs",
        "src/lib/meta-plan-import-transport.mjs",
        "src/lib/meta-test-recipient-binding.mjs",
        "src/lib/meta-whatsapp-transport.mjs",
        "src/lib/organization-resource-usage-policy.mjs",
        "src/lib/organization-usage-policy.mjs",
        "src/lib/participant-account-discovery.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-bank-account.mjs",
        "src/lib/participant-bank-format.mjs",
        "src/lib/participant-bank-vault.mjs",
        "src/lib/participant-channel-kyc.mjs",
        "src/lib/participant-civil-policy.mjs",
        "src/lib/participant-civil-store.mjs",
        "src/lib/participant-kyc-chat-attempt.mjs",
        "src/lib/participant-kyc-chat-closure.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/participant-kyc-notice-links.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs",
        "src/lib/participant-onboarding-authority.mjs",
        "src/lib/participant-onboarding-current-kyc.mjs",
        "src/lib/participant-onboarding-delivery.mjs",
        "src/lib/participant-onboarding-intent.mjs",
        "src/lib/participant-onboarding-policy.mjs",
        "src/lib/participant-onboarding-reactive.mjs",
        "src/lib/participant-policy.mjs",
        "src/lib/participant-store.mjs",
        "src/lib/participant-verified-office.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/pilot-media.mjs",
        "src/lib/plan-baseline-policy.mjs",
        "src/lib/plan-budget-source.mjs",
        "src/lib/plan-import-analyzer.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/plan-import-monthly-curve.mjs",
        "src/lib/plan-import-ooxml.mjs",
        "src/lib/plan-import-policy.mjs",
        "src/lib/plan-import-store.mjs",
        "src/lib/plan-measurement-configuration.mjs",
        "src/lib/plan-measurement-policy.mjs",
        "src/lib/plan-measurement-source.mjs",
        "src/lib/plan-measurement-store.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-consumption-draft.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/whatsapp/field-worker-intent-policy.js",
        "src/lib/whatsapp/obra-intent-policy.js",
        "src/lib/whatsapp/operational-proposal-decision-policy.js",
        "src/lib/whatsapp/project-workspace-profile.js",
        "src/lib/whatsapp/template-review-policy.js",
        "src/lib/whatsapp/tenant-workspace-policy.js",
        "src/lib/worker-channel-consent-policy.mjs",
        "src/lib/worker-channel-identity.mjs",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-store.mjs",
        "tests/fixtures/plan-import-ooxml-synthetic.mjs",
        "tests/fixtures/plan-measurement-source-synthetic.mjs"
      ],
      "externalImports": [
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "node:zlib",
        "pg",
        "saxes",
        "yauzl"
      ],
      "currentManifest": [
        {
          "path": "scripts/fixtures/canonical-participant-kyc.mjs",
          "sha256": "09928b417f3319d76ba34fac91f89a1888f3a8e613bfde3775cac424cc441ccb"
        },
        {
          "path": "scripts/lib/company-channel-disposable-fixture.mjs",
          "sha256": "717d87a6fb1dd7f6a8b2a2d19cd3b2fee652d536e958bd833bf8431c31076138"
        },
        {
          "path": "scripts/lib/disposable-postgres-cleanup.mjs",
          "sha256": "df8d9f36b79cdd5f2d940c0dc4bbc88acbb0bec6e66c9ee5ae93ad5c6e4ab89e"
        },
        {
          "path": "scripts/verify-plan-measurement-postgres.mjs",
          "sha256": "13a022b79f8b2934cb353b81aa1be0ed52d48af95ad457746d4b884aa3260ba4"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/lib/bindx-civil-data-client.mjs",
          "sha256": "20da64b82d14fb3d4055b9852ed8712d33b01d1bc9f50709cb55084c7d0433a2"
        },
        {
          "path": "src/lib/brand-assets.mjs",
          "sha256": "7da49f3f4d8c2f9d2cce36cc2902b5f46e044b98e67bace09e240f5b007fd4c1"
        },
        {
          "path": "src/lib/canonical-invited-account.mjs",
          "sha256": "94652997c4e6717e875041c859de9caaaeeabd9d166666d9dfbf899c51d98c7b"
        },
        {
          "path": "src/lib/company-channel-connection.mjs",
          "sha256": "f2c44860383bb49df67f7999fbe3c0a5aa57c91ebbde0cf9a3b5b367784f2c45"
        },
        {
          "path": "src/lib/company-channel-kyc.mjs",
          "sha256": "5b46276ad3aa5d656a0027be4a6bf58aa3fba4f557dd86e0c13d0d5b0cecba85"
        },
        {
          "path": "src/lib/company-channel-routing.mjs",
          "sha256": "9ed740dbb4ae1ca7d44171f176f0001d824b056a0f17a8f58ed1ea5a5a2e2f68"
        },
        {
          "path": "src/lib/company-channel-schema.mjs",
          "sha256": "96c0385fa3b6d60c8d1f92ca38dcdf32e7779f1200512806bf6d220e6be57022"
        },
        {
          "path": "src/lib/company-entitlement.mjs",
          "sha256": "65d41dfb796ef12be38b1220a99ccd3dfe277419a5e5a27e125beb29fe7e2cde"
        },
        {
          "path": "src/lib/company-onboarding-policy.mjs",
          "sha256": "cf557c7837d6264c78207028c668f8f8a2218f9632a8092cfcb8692ef11053d1"
        },
        {
          "path": "src/lib/company-phone-format.mjs",
          "sha256": "67b31114f517253961c6a774210f157867b1e2e318e6b700089eef03ef1b7209"
        },
        {
          "path": "src/lib/employee-intake-channel-continuity.mjs",
          "sha256": "59dffe3800f26cd979bd12c4cff0010ca72779e1dc62030a6f0117b6ef3fb64d"
        },
        {
          "path": "src/lib/field-hours-report.mjs",
          "sha256": "b55b767d61278bde31cb9ce4ef64faee5320fc7fe1b1bcc54559860bb4576731"
        },
        {
          "path": "src/lib/field-media-privacy.mjs",
          "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
        },
        {
          "path": "src/lib/field-media.mjs",
          "sha256": "d221ab87c4639aadb6eb8788a7203cee072f6eb1deca40605fc3d02742ab9d65"
        },
        {
          "path": "src/lib/field-operations-policy.mjs",
          "sha256": "bb33655b622a081de656f24c2e369fe7a2e05a0a0a9da7ffe455c2f39fd8fbd5"
        },
        {
          "path": "src/lib/field-operations-store.mjs",
          "sha256": "517267adb96c69bce58350b98b3a4e335ca1304a72a824e35998590e95b8987c"
        },
        {
          "path": "src/lib/field-overtime-policy.mjs",
          "sha256": "76848bd0861d6cecccb682b774599f03d3fe1322eed3cc58f5f1db5d9b1e24f8"
        },
        {
          "path": "src/lib/field-overtime-store.mjs",
          "sha256": "f29b67fff29949d5a8b14c4aed3f484ae1ce16d2ed42de486a6d5868361b1526"
        },
        {
          "path": "src/lib/field-report-feedback.mjs",
          "sha256": "70b966ae5f382abe6b5446daf1092c3f66b8f46f80ce5a0c006cffeba1cfa64c"
        },
        {
          "path": "src/lib/field-shift-summary.mjs",
          "sha256": "41f47aa7a0826ba1fe29b554c7575ec60c9861f0c18c863f06e8c3d00cb0f83c"
        },
        {
          "path": "src/lib/geo.js",
          "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
        },
        {
          "path": "src/lib/legacy-access-boundary.js",
          "sha256": "e1af7e83dac3c18bcf3b235d111d936d6dd6167925a3e1459d70a33913035370"
        },
        {
          "path": "src/lib/material-inventory.mjs",
          "sha256": "3af0b0e9c9003d09582ec4e8b21d1e35746dd3839fc7f01071935b9a4ea95333"
        },
        {
          "path": "src/lib/meta-callback-diagnostics.mjs",
          "sha256": "b16fcfbeabe02b119d0337485504490a0c8e60363e841e378ae4c7722816d3bc"
        },
        {
          "path": "src/lib/meta-channel-binding.mjs",
          "sha256": "0ba9e9de3b6dcca46524ab2df22236dbbcd5be5e6cef571df1ec47a01633672e"
        },
        {
          "path": "src/lib/meta-cloud-protocol.mjs",
          "sha256": "c6d5f1e1b4119dd2529860e3bd61a1b22d602f71ad301b2f04cec3ab4bbbed3c"
        },
        {
          "path": "src/lib/meta-consumption-evidence-catalog.mjs",
          "sha256": "cd4eb1ccf8617060aa2bb352cc9467981f7d17649be8b24233413c133c407bff"
        },
        {
          "path": "src/lib/meta-customer-app-projection.mjs",
          "sha256": "7b4b95712f143555a0e23b8ac98fc0e1d2f108e9fbefb4e861d20d9b464ef003"
        },
        {
          "path": "src/lib/meta-customer-callback.mjs",
          "sha256": "da90e3ed097c287a7c080d05daf5e4b0c0bb82544d2f7dab4cb1ee99880c3fd0"
        },
        {
          "path": "src/lib/meta-customer-coexistence.mjs",
          "sha256": "2cf704b2d3842d4ff7ae48a438c1271ad610ccf4e92a6214d97338e91e999c8e"
        },
        {
          "path": "src/lib/meta-customer-credentials.mjs",
          "sha256": "44a05a0b46417de835eb289882b0b2c6d71158f207c16c48228f1ac4b67cca0f"
        },
        {
          "path": "src/lib/meta-customer-inbox-review.mjs",
          "sha256": "250bd69c487dc8dffed5500c1ca0f9adb77843352902c41e4a63da7656bf2eaa"
        },
        {
          "path": "src/lib/meta-customer-outbound.mjs",
          "sha256": "84a249b3777d3be843b20b09d0c6cd81b6fab7415dc22f124477d87475eead09"
        },
        {
          "path": "src/lib/meta-customer-permissions.mjs",
          "sha256": "ce3671bd46af8e487c45319facbca8e6b522620fd16ee3163e5048b5ecb6585d"
        },
        {
          "path": "src/lib/meta-customer-processing.mjs",
          "sha256": "e4a52dbd2ce86793b66c4af5963c288b13d7b2b2f656c4c6f795bcac8074f4ad"
        },
        {
          "path": "src/lib/meta-customer-provider.mjs",
          "sha256": "102ae45ad7d0a1054d2c65cdbfa3a6a96accfcd982bebce8d6c32c7bf24b21a2"
        },
        {
          "path": "src/lib/meta-customer-templates.mjs",
          "sha256": "ca9e491b8b1b4c25c89585408cb53eae13e2423fdf48a93deed0846126e1c46c"
        },
        {
          "path": "src/lib/meta-development-pilot-policy.mjs",
          "sha256": "6f3a854898ea28d108341f35fe7f5f23facf3d574e586b96a2343a8038cc8c79"
        },
        {
          "path": "src/lib/meta-employee-intake.mjs",
          "sha256": "72e80601323adbe35c9ec1f61e49e3428007da55e567c724ca8dce3c42de042b"
        },
        {
          "path": "src/lib/meta-field-bridge.mjs",
          "sha256": "7f3bb80ba828e202f24e1d768b855131642dcc89fde39fcac4b81d64aa632955"
        },
        {
          "path": "src/lib/meta-field-conversation.mjs",
          "sha256": "c68887db8fa04f5806d1c0f4c29e829befb89931b8371041ad65334deb1dab4d"
        },
        {
          "path": "src/lib/meta-kyc-challenge.mjs",
          "sha256": "f5a03ec770e6d85de095393bf38c331c0803a7fe3c7f1b72a2addd9cac7484eb"
        },
        {
          "path": "src/lib/meta-kyc-conversation.mjs",
          "sha256": "17d1e52e826dcaa899e2e6b846e2856c73f73b18b7abfe30e951de0de8623ef6"
        },
        {
          "path": "src/lib/meta-kyc-current-image.mjs",
          "sha256": "03ef3966025f520b373e937a6230f846185f3b4845830da5a38c0d8f02e155c2"
        },
        {
          "path": "src/lib/meta-kyc-identity.mjs",
          "sha256": "295f87ecb3b4586313a4f9c48a2d5c9acf8fa263682d99d44a966be243af2319"
        },
        {
          "path": "src/lib/meta-kyc-rejection-policy.mjs",
          "sha256": "e6c96aba8077d75e152f45dc49fe32d41e103658d4bff4281c8c8a98e3fff0c1"
        },
        {
          "path": "src/lib/meta-kyc-rejection.mjs",
          "sha256": "5477adafd994a54c9e7bbcc196b6af4fbe0b9cc03ab563775b8258290e31f3d0"
        },
        {
          "path": "src/lib/meta-own-company-policy.mjs",
          "sha256": "7db3875cd0f31fec077f4d9a4f8875be1ddf4a5772acff4559069ae950ff0821"
        },
        {
          "path": "src/lib/meta-plan-import-conversation.mjs",
          "sha256": "6f3c261cb2cde943e0202ab5097d664958f5702975cdf5914aeac35e5a1bac1c"
        },
        {
          "path": "src/lib/meta-plan-import-origin.mjs",
          "sha256": "cdb619d1709a982323c9892383def1428db2ade771babdb18e4032b3535d953e"
        },
        {
          "path": "src/lib/meta-plan-import-transport.mjs",
          "sha256": "e42f48f0175dd697bac3de61d7d9893d35c2b1696c1ae276a4698eb3c36a4634"
        },
        {
          "path": "src/lib/meta-test-recipient-binding.mjs",
          "sha256": "2aea6f5815bd2d90fe891b45a79b48d339a3eebc681ac40b3347244e546c4b66"
        },
        {
          "path": "src/lib/meta-whatsapp-transport.mjs",
          "sha256": "f99569c7f587e9be1268aa254d2368226346a7ebf7e48fa6ca63a0064cf41310"
        },
        {
          "path": "src/lib/organization-resource-usage-policy.mjs",
          "sha256": "089ac1ee2ca6afd30aab1d0abd38274698ca56991d1c5225ea8e44c8b9fdc449"
        },
        {
          "path": "src/lib/organization-usage-policy.mjs",
          "sha256": "94997530d6c1fd420f0233172b07f8ba7dd7546a2ac9af75eaa30736400237ae"
        },
        {
          "path": "src/lib/participant-account-discovery.mjs",
          "sha256": "11b37ca397fdb195aac7addc1c16842fb28a9c83a73a82a57bf2791ed3038738"
        },
        {
          "path": "src/lib/participant-admission.mjs",
          "sha256": "2cbb466e49d742cd23da1bb85a4e89b7e411dc724c8d1f2eb66b39717f283dd9"
        },
        {
          "path": "src/lib/participant-analysis-consent.mjs",
          "sha256": "7f7d371914d1e46ac799cd1683afdc0418186c15a20156e697ecd879c81bf8c1"
        },
        {
          "path": "src/lib/participant-approved-identity.mjs",
          "sha256": "834d81e70cedbd967ff84d880ea9d697c2168d2220fb23d9eb14c1aba1cdbbf1"
        },
        {
          "path": "src/lib/participant-bank-account.mjs",
          "sha256": "29980527a6eda3bbc0125098a4b616082034a71fb1afb772ff87f476bc0ce981"
        },
        {
          "path": "src/lib/participant-bank-format.mjs",
          "sha256": "ebbb206a14eaac57230b53ec1afae99c4be60c8739baf0d1d047d4a47ba464db"
        },
        {
          "path": "src/lib/participant-bank-vault.mjs",
          "sha256": "06e990ab79c896628756f3c74a50dcc7e8062f4fa296f56a31e4150b5badc16a"
        },
        {
          "path": "src/lib/participant-channel-kyc.mjs",
          "sha256": "2ac9414429238162a9b16d4adea421df0bff9fb93ea4fbf2f9d6677f2659fb2d"
        },
        {
          "path": "src/lib/participant-civil-policy.mjs",
          "sha256": "e180a64c788d6cd20e766cb4fd32dbba1c7cb3954c01405ac8675ec023eef278"
        },
        {
          "path": "src/lib/participant-civil-store.mjs",
          "sha256": "5f440c0c76ca67b87a7e5d4e90e7a48f18ea3603b16434b35beeddd3bdf168a4"
        },
        {
          "path": "src/lib/participant-kyc-chat-attempt.mjs",
          "sha256": "d3f0a65f866fa027ee008963fcb6ffcad0cd33de94cace7603cf40bc78c21aeb"
        },
        {
          "path": "src/lib/participant-kyc-chat-closure.mjs",
          "sha256": "4a6a368910de95582c2baabc70bab7f4b4afa4413e8ebdb75a1e8b867c098a19"
        },
        {
          "path": "src/lib/participant-kyc-chat-copy.mjs",
          "sha256": "d886219584d5e8b9d9db1ad16a36c726f6982fa0e8400c3be51af2623574ab96"
        },
        {
          "path": "src/lib/participant-kyc-image-set.mjs",
          "sha256": "190ce2560286a58d42668da7b912aeabcfa76ee14086503bf1609304e5f0e8fb"
        },
        {
          "path": "src/lib/participant-kyc-notice-links.mjs",
          "sha256": "3547f3fc2ebdefc2522971467d4c77498160dde7806a25bf9fa18c527c8658fc"
        },
        {
          "path": "src/lib/participant-kyc-preanalysis-policy.mjs",
          "sha256": "8c5286a0a5d41364e92e60f2ce2ba96caccc8667960f966b5caead37acafab49"
        },
        {
          "path": "src/lib/participant-onboarding-authority.mjs",
          "sha256": "dad5d9fd0a61c493ff02331d5333982627cdeb3a7addb74a3c86d44da931f916"
        },
        {
          "path": "src/lib/participant-onboarding-current-kyc.mjs",
          "sha256": "232fecca4f6cf775e5151ec460560e0c1abd6646dc3c532140cabe26dfb42119"
        },
        {
          "path": "src/lib/participant-onboarding-delivery.mjs",
          "sha256": "615592cc1a6215e24c48e8873a27211421853f99ca9093e6f490f77532b3d013"
        },
        {
          "path": "src/lib/participant-onboarding-intent.mjs",
          "sha256": "07114f6066e10617357c4e5d8e2db2b9dc846e5f4cffbc5aef09f2b7bfada9de"
        },
        {
          "path": "src/lib/participant-onboarding-policy.mjs",
          "sha256": "59409797ce3e13b7cfe63fe21d8d7e2c848ee49e0766015939242a9f43687c03"
        },
        {
          "path": "src/lib/participant-onboarding-reactive.mjs",
          "sha256": "666a8c27f3ab7d6fdbe66c91f22ace4e25b04b98e865f401d19c72212916104d"
        },
        {
          "path": "src/lib/participant-policy.mjs",
          "sha256": "7f3969ab1ebac5f01696149d76337199eb64c2fd09015c44c07e8b7e7088d62f"
        },
        {
          "path": "src/lib/participant-store.mjs",
          "sha256": "2296495e366b9ea0c2511066584e93ddf1cff51b5eefd05c6121d2143d78f5c9"
        },
        {
          "path": "src/lib/participant-verified-office.mjs",
          "sha256": "4922f392490aa6d49b8a8a45a56ac0b03831a8ad2efe89ce1e3adfd77d603d89"
        },
        {
          "path": "src/lib/person-worksite-journey.mjs",
          "sha256": "d3174df793150125c0b6a5d9f37d56336e72cab1efb43a361065b78ac54c210a"
        },
        {
          "path": "src/lib/pilot-media.mjs",
          "sha256": "55e35757cea03c312df68cebad100ee8b7d904b418eca9082359ea34e68f8fa9"
        },
        {
          "path": "src/lib/plan-baseline-policy.mjs",
          "sha256": "e9217a41a87057f437439420d56f3b7a0f973ae37c250c07b335634fef308560"
        },
        {
          "path": "src/lib/plan-budget-source.mjs",
          "sha256": "7ebeabf62d8fb89c6ab941b8130d196ca2e008959a9599f2db0c71d75dd3382a"
        },
        {
          "path": "src/lib/plan-import-analyzer.mjs",
          "sha256": "a132a09a7f69f218a244a46f55b9da9d873bae33c753f9d73c8c15a7daaeb9c0"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/plan-import-monthly-curve.mjs",
          "sha256": "6ce785f9c24c47f0e291b0bac40bd96a691fae68a309e4cb7a1917db31f9e6b6"
        },
        {
          "path": "src/lib/plan-import-ooxml.mjs",
          "sha256": "662abaa7523d74961c6873a8b0beb3eb7e3d3b52988fad9cc55e76c0e540a3bd"
        },
        {
          "path": "src/lib/plan-import-policy.mjs",
          "sha256": "1946b2793d0db11519d154acdb5bf0f7e8be5dc26ecd1971b846eed284d7d50f"
        },
        {
          "path": "src/lib/plan-import-store.mjs",
          "sha256": "da047723f790c0f5e7eeff855782e4db7463670d1875caf0bab1c6cce9b1a920"
        },
        {
          "path": "src/lib/plan-measurement-configuration.mjs",
          "sha256": "d016926aec29c0f3bf60f8b012e5c52e2bd1c7e2188d4534b7579f7aee28b08d"
        },
        {
          "path": "src/lib/plan-measurement-policy.mjs",
          "sha256": "3d6b0bce58a7f89612878310f534d8cf02f6a222c778cd4294b415c1f61157b7"
        },
        {
          "path": "src/lib/plan-measurement-source.mjs",
          "sha256": "ecf33b67a333d8ce73bfb51610218a1658cd94a26b62eb35d2290b795f826f36"
        },
        {
          "path": "src/lib/plan-measurement-store.mjs",
          "sha256": "f1267df1fcd5ddc7d5ce6bfbf6693cda124135350025579075ed2ba8460334f2"
        },
        {
          "path": "src/lib/private-image-upload.mjs",
          "sha256": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60"
        },
        {
          "path": "src/lib/procurement-quantity.js",
          "sha256": "53439844051cc1dbd679220d695e60e54bc1629b2f1ddb33fc125981da9326b3"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/site-register-policy.mjs",
          "sha256": "d529c4f2225e0ec851ef7df60f8c5b182a88b384958ebfd15b194683d1590434"
        },
        {
          "path": "src/lib/site-register-store.mjs",
          "sha256": "6b744c86f47dbb6dc081132675888615d76421701f96151b00646b5e1d2529c6"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/video-audio-extractor.mjs",
          "sha256": "0c85dfd39c10fdb782eca4fe57dc665c29bd7211ab7aba0dda3f8945abcb1988"
        },
        {
          "path": "src/lib/video-frame-extractor.mjs",
          "sha256": "33425a184cf097884982c43a90e3b515726027adbeb51c2cdbfc794e79dee6e6"
        },
        {
          "path": "src/lib/voice-consumption-draft.mjs",
          "sha256": "b9af424825674ca6f24a729e9ba89bae6e67adf433de10837a05e58900584c82"
        },
        {
          "path": "src/lib/voice-progress-draft.mjs",
          "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
        },
        {
          "path": "src/lib/whatsapp/field-worker-intent-policy.js",
          "sha256": "0fdf205af1c2185a16f99c4f1aaba6c36d95722ea914915a0eefe6a10d443ef9"
        },
        {
          "path": "src/lib/whatsapp/obra-intent-policy.js",
          "sha256": "cd01054ba81be6552f58dc91758e08166ea099482f28355cae570d15f3ccf8da"
        },
        {
          "path": "src/lib/whatsapp/operational-proposal-decision-policy.js",
          "sha256": "996ed641c090267679ce0fc3cb7a23f39b31ce88e761135feb0dd0c852eb74fc"
        },
        {
          "path": "src/lib/whatsapp/project-workspace-profile.js",
          "sha256": "e13473baa4ca5b4dc9851bb202f400ba174ccbfce2589be65ce8458aafa998f4"
        },
        {
          "path": "src/lib/whatsapp/template-review-policy.js",
          "sha256": "0ec4a7e544f8c2c2409d2c84ecf69fab663334dd5a5cef0ee1b1cbec82de0a08"
        },
        {
          "path": "src/lib/whatsapp/tenant-workspace-policy.js",
          "sha256": "d3416ff993fbfd70f75404166cdcd8f0b9b2e5a6741f6cde03725aab16abcd5e"
        },
        {
          "path": "src/lib/worker-channel-consent-policy.mjs",
          "sha256": "95c8393e7f2603694c5c15cfe34c9eead43007927aed0d5b633859b14c7448a9"
        },
        {
          "path": "src/lib/worker-channel-identity.mjs",
          "sha256": "1cddd58a2cd656abaca25752481fe1ca760d2bcd385a0fffbe0e685c15d59e0a"
        },
        {
          "path": "src/lib/workspace-policy.mjs",
          "sha256": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e"
        },
        {
          "path": "src/lib/workspace-store.mjs",
          "sha256": "5f25092121a31a06eefa59d69866db82fa3cd28afdcbd0e066e52d916478bc50"
        },
        {
          "path": "tests/fixtures/plan-import-ooxml-synthetic.mjs",
          "sha256": "4157135abf5798807025a18abd121c7fdbc7be2a5e0099084bbb02ea28f20931"
        },
        {
          "path": "tests/fixtures/plan-measurement-source-synthetic.mjs",
          "sha256": "9e62b4d9caef2f739e3624e13f7c0cb14c6f1d9a7e2266801a45bf7fb367410c"
        }
      ]
    },
    {
      "family": "MEASUREMENT_UI",
      "previousFiles": [
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-measurement-panel.js",
        "src/app/(identity)/cuenta/plan-measurement-panel.module.css",
        "src/app/(identity)/cuenta/plan-measurement-view.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/progress-measurement-quantity.js"
      ],
      "previousExternalImports": [
        "react"
      ],
      "currentFiles": [
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-measurement-panel.js",
        "src/app/(identity)/cuenta/plan-measurement-panel.module.css",
        "src/app/(identity)/cuenta/plan-measurement-view.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/progress-measurement-quantity.js"
      ],
      "externalImports": [
        "react"
      ],
      "currentManifest": [
        {
          "path": "src/app/(identity)/cuenta/company-channel-view.mjs",
          "sha256": "c79c473999e444b84e2a1d58e0d03f030069c24f9749f2c84450318b0b237e4d"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-number-view.mjs",
          "sha256": "6940f11e30d2958d7f6771463ce28ca83c0e2d2f41e81aa220c8efe669580300"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-templates-view.mjs",
          "sha256": "3bf758b150336613a437e2b01d3b6a79645a024b771f1515f4ec2ae58a1b8bc3"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-office-account-view.mjs",
          "sha256": "f2716f72297a1277946bafa03a82d4c1fb7f2fcff7f4c4bbe155a86ed7e4e379"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline-view.mjs",
          "sha256": "0c696eba748a7441440e23be5085dc42d4954427def5adc1e2de686b4b11711d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-measurement-panel.js",
          "sha256": "d9d1cd683a8aaf0ad1ea5656c03c12c00935c3653f54d9326196617b60039832"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-measurement-panel.module.css",
          "sha256": "8290affa492be1699acb568c2ee4c8c5c672b3f2b06e2917f541c72bdacbde3a"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-measurement-view.mjs",
          "sha256": "02a80449af709fdda97dfaf48b0335bd96ab7dc363804f59a5d9ea8579581d30"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.mjs",
          "sha256": "689402d373744d159a62e2e5975ddfdf79053c528a838879dd5df3e43a0efdc9"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-view.mjs",
          "sha256": "58ebd978e8e39423901cb811ecf2ab851160b78f7cd5cb441075d66d7819dee9"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
          "sha256": "3a8d1c517fb084df425198c84671f6b76bb1f659f9d0d4ed94945cd1046d8e64"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
          "sha256": "d8cf1e7e8d88d66f722aaf52deb45f95829c226468d3f37a2b23d171cc1ecbb8"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
          "sha256": "b3004538de2cc7cbc829bf5518c4f4b2a5eb2935d0b4e60f9c88840c8ede3797"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
          "sha256": "590cd7691d8b6beb82929bdd18dd9909c2d2cfa1c3d4111ff4d478d57daf532f"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-session-request.mjs",
          "sha256": "29d294ac1d973317d6a3df225a64a8a9115c6ea51c587f297114e7992af97520"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        }
      ]
    },
    {
      "family": "MEASUREMENT_UI_RUNTIME",
      "previousFiles": [
        "scripts/lib/owned-fixture-cleanup.mjs",
        "scripts/verify-plan-measurement-ui.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/plan-import-monthly-curve.mjs",
        "src/lib/plan-import-ooxml.mjs",
        "src/lib/plan-import-policy.mjs",
        "src/lib/plan-measurement-configuration.mjs",
        "src/lib/plan-measurement-http.mjs",
        "src/lib/plan-measurement-policy.mjs",
        "src/lib/plan-measurement-source.mjs",
        "src/lib/plan-measurement-store.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/task-progress-measurement.js",
        "src/lib/workspace-policy.mjs",
        "tests/fixtures/plan-measurement-document-association-synthetic.mjs"
      ],
      "previousExternalImports": [
        "@babel/parser",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:net",
        "node:path",
        "node:timers/promises",
        "node:url",
        "node:zlib",
        "puppeteer",
        "saxes",
        "yauzl"
      ],
      "currentFiles": [
        "scripts/lib/owned-fixture-cleanup.mjs",
        "scripts/verify-plan-measurement-ui.mjs",
        "src/lib/plan-budget-source.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/plan-import-monthly-curve.mjs",
        "src/lib/plan-import-ooxml.mjs",
        "src/lib/plan-import-policy.mjs",
        "src/lib/plan-measurement-configuration.mjs",
        "src/lib/plan-measurement-http.mjs",
        "src/lib/plan-measurement-policy.mjs",
        "src/lib/plan-measurement-source.mjs",
        "src/lib/plan-measurement-store.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/task-progress-measurement.js",
        "src/lib/workspace-policy.mjs",
        "tests/fixtures/plan-measurement-document-association-synthetic.mjs"
      ],
      "externalImports": [
        "@babel/parser",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:net",
        "node:path",
        "node:timers/promises",
        "node:url",
        "node:zlib",
        "puppeteer",
        "saxes",
        "yauzl"
      ],
      "currentManifest": [
        {
          "path": "scripts/lib/owned-fixture-cleanup.mjs",
          "sha256": "44a9df241dd8426fe8d148b1b33110fe1e103960814e81f1f9a41638d8613844"
        },
        {
          "path": "scripts/verify-plan-measurement-ui.mjs",
          "sha256": "12dcd1879cde33a9d6b8d696d9de8907ce29ad29c8eb808f727be8206bc19f5c"
        },
        {
          "path": "src/lib/plan-budget-source.mjs",
          "sha256": "7ebeabf62d8fb89c6ab941b8130d196ca2e008959a9599f2db0c71d75dd3382a"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/plan-import-monthly-curve.mjs",
          "sha256": "6ce785f9c24c47f0e291b0bac40bd96a691fae68a309e4cb7a1917db31f9e6b6"
        },
        {
          "path": "src/lib/plan-import-ooxml.mjs",
          "sha256": "662abaa7523d74961c6873a8b0beb3eb7e3d3b52988fad9cc55e76c0e540a3bd"
        },
        {
          "path": "src/lib/plan-import-policy.mjs",
          "sha256": "1946b2793d0db11519d154acdb5bf0f7e8be5dc26ecd1971b846eed284d7d50f"
        },
        {
          "path": "src/lib/plan-measurement-configuration.mjs",
          "sha256": "d016926aec29c0f3bf60f8b012e5c52e2bd1c7e2188d4534b7579f7aee28b08d"
        },
        {
          "path": "src/lib/plan-measurement-http.mjs",
          "sha256": "e53a2b218b9ea68c396fe6889f6981b01d9a879ec74d9cf8bafc0bf1920c8e76"
        },
        {
          "path": "src/lib/plan-measurement-policy.mjs",
          "sha256": "3d6b0bce58a7f89612878310f534d8cf02f6a222c778cd4294b415c1f61157b7"
        },
        {
          "path": "src/lib/plan-measurement-source.mjs",
          "sha256": "ecf33b67a333d8ce73bfb51610218a1658cd94a26b62eb35d2290b795f826f36"
        },
        {
          "path": "src/lib/plan-measurement-store.mjs",
          "sha256": "f1267df1fcd5ddc7d5ce6bfbf6693cda124135350025579075ed2ba8460334f2"
        },
        {
          "path": "src/lib/private-image-upload.mjs",
          "sha256": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/workspace-policy.mjs",
          "sha256": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e"
        },
        {
          "path": "tests/fixtures/plan-measurement-document-association-synthetic.mjs",
          "sha256": "99608056326f95f963b99c8b2337227f5564411a35e03dcaa43d638bb085adfa"
        }
      ]
    },
    {
      "family": "CONSUMPTION_FEEDBACK",
      "previousFiles": [
        "package-lock.json",
        "package.json",
        "scripts/fixtures/canonical-participant-kyc.mjs",
        "scripts/lib/company-channel-disposable-fixture.mjs",
        "scripts/lib/disposable-postgres-cleanup.mjs",
        "scripts/verify-material-consumption-feedback-postgres.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/lib/bindx-civil-data-client.mjs",
        "src/lib/brand-assets.mjs",
        "src/lib/canonical-invited-account.mjs",
        "src/lib/company-channel-connection.mjs",
        "src/lib/company-channel-kyc.mjs",
        "src/lib/company-channel-routing.mjs",
        "src/lib/company-channel-schema.mjs",
        "src/lib/company-entitlement.mjs",
        "src/lib/company-onboarding-policy.mjs",
        "src/lib/company-phone-format.mjs",
        "src/lib/employee-intake-channel-continuity.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/legacy-access-boundary.js",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-callback-diagnostics.mjs",
        "src/lib/meta-channel-binding.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/meta-customer-app-projection.mjs",
        "src/lib/meta-customer-callback.mjs",
        "src/lib/meta-customer-coexistence.mjs",
        "src/lib/meta-customer-credentials.mjs",
        "src/lib/meta-customer-inbox-review.mjs",
        "src/lib/meta-customer-outbound.mjs",
        "src/lib/meta-customer-permissions.mjs",
        "src/lib/meta-customer-processing.mjs",
        "src/lib/meta-customer-provider.mjs",
        "src/lib/meta-customer-templates.mjs",
        "src/lib/meta-development-pilot-policy.mjs",
        "src/lib/meta-employee-intake.mjs",
        "src/lib/meta-field-bridge.mjs",
        "src/lib/meta-field-conversation.mjs",
        "src/lib/meta-kyc-challenge.mjs",
        "src/lib/meta-kyc-conversation.mjs",
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/meta-kyc-identity.mjs",
        "src/lib/meta-kyc-rejection-policy.mjs",
        "src/lib/meta-kyc-rejection.mjs",
        "src/lib/meta-own-company-policy.mjs",
        "src/lib/meta-plan-import-conversation.mjs",
        "src/lib/meta-plan-import-origin.mjs",
        "src/lib/meta-plan-import-transport.mjs",
        "src/lib/meta-test-recipient-binding.mjs",
        "src/lib/meta-whatsapp-transport.mjs",
        "src/lib/organization-resource-usage-policy.mjs",
        "src/lib/organization-usage-policy.mjs",
        "src/lib/participant-account-discovery.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-bank-account.mjs",
        "src/lib/participant-bank-format.mjs",
        "src/lib/participant-bank-vault.mjs",
        "src/lib/participant-channel-kyc.mjs",
        "src/lib/participant-civil-policy.mjs",
        "src/lib/participant-civil-store.mjs",
        "src/lib/participant-kyc-chat-attempt.mjs",
        "src/lib/participant-kyc-chat-closure.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/participant-kyc-notice-links.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs",
        "src/lib/participant-onboarding-authority.mjs",
        "src/lib/participant-onboarding-current-kyc.mjs",
        "src/lib/participant-onboarding-delivery.mjs",
        "src/lib/participant-onboarding-intent.mjs",
        "src/lib/participant-onboarding-policy.mjs",
        "src/lib/participant-onboarding-reactive.mjs",
        "src/lib/participant-policy.mjs",
        "src/lib/participant-store.mjs",
        "src/lib/participant-verified-office.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/pilot-media.mjs",
        "src/lib/plan-baseline-policy.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/plan-import-monthly-curve.mjs",
        "src/lib/plan-import-ooxml.mjs",
        "src/lib/plan-import-policy.mjs",
        "src/lib/plan-import-store.mjs",
        "src/lib/plan-measurement-policy.mjs",
        "src/lib/plan-measurement-source.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/whatsapp/field-worker-intent-policy.js",
        "src/lib/whatsapp/obra-intent-policy.js",
        "src/lib/whatsapp/operational-proposal-decision-policy.js",
        "src/lib/whatsapp/project-workspace-profile.js",
        "src/lib/whatsapp/template-review-policy.js",
        "src/lib/whatsapp/tenant-workspace-policy.js",
        "src/lib/worker-channel-consent-policy.mjs",
        "src/lib/worker-channel-identity.mjs",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-store.mjs"
      ],
      "previousExternalImports": [
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "node:zlib",
        "pg",
        "saxes",
        "yauzl"
      ],
      "currentFiles": [
        "package-lock.json",
        "package.json",
        "scripts/fixtures/canonical-participant-kyc.mjs",
        "scripts/lib/company-channel-disposable-fixture.mjs",
        "scripts/lib/disposable-postgres-cleanup.mjs",
        "scripts/verify-material-consumption-feedback-postgres.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/lib/bindx-civil-data-client.mjs",
        "src/lib/brand-assets.mjs",
        "src/lib/canonical-invited-account.mjs",
        "src/lib/company-channel-connection.mjs",
        "src/lib/company-channel-kyc.mjs",
        "src/lib/company-channel-routing.mjs",
        "src/lib/company-channel-schema.mjs",
        "src/lib/company-entitlement.mjs",
        "src/lib/company-onboarding-policy.mjs",
        "src/lib/company-phone-format.mjs",
        "src/lib/employee-intake-channel-continuity.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/legacy-access-boundary.js",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-callback-diagnostics.mjs",
        "src/lib/meta-channel-binding.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/meta-consumption-evidence-catalog.mjs",
        "src/lib/meta-customer-app-projection.mjs",
        "src/lib/meta-customer-callback.mjs",
        "src/lib/meta-customer-coexistence.mjs",
        "src/lib/meta-customer-credentials.mjs",
        "src/lib/meta-customer-inbox-review.mjs",
        "src/lib/meta-customer-outbound.mjs",
        "src/lib/meta-customer-permissions.mjs",
        "src/lib/meta-customer-processing.mjs",
        "src/lib/meta-customer-provider.mjs",
        "src/lib/meta-customer-templates.mjs",
        "src/lib/meta-development-pilot-policy.mjs",
        "src/lib/meta-employee-intake.mjs",
        "src/lib/meta-field-bridge.mjs",
        "src/lib/meta-field-conversation.mjs",
        "src/lib/meta-kyc-challenge.mjs",
        "src/lib/meta-kyc-conversation.mjs",
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/meta-kyc-identity.mjs",
        "src/lib/meta-kyc-rejection-policy.mjs",
        "src/lib/meta-kyc-rejection.mjs",
        "src/lib/meta-own-company-policy.mjs",
        "src/lib/meta-plan-import-conversation.mjs",
        "src/lib/meta-plan-import-origin.mjs",
        "src/lib/meta-plan-import-transport.mjs",
        "src/lib/meta-test-recipient-binding.mjs",
        "src/lib/meta-whatsapp-transport.mjs",
        "src/lib/organization-resource-usage-policy.mjs",
        "src/lib/organization-usage-policy.mjs",
        "src/lib/participant-account-discovery.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-bank-account.mjs",
        "src/lib/participant-bank-format.mjs",
        "src/lib/participant-bank-vault.mjs",
        "src/lib/participant-channel-kyc.mjs",
        "src/lib/participant-civil-policy.mjs",
        "src/lib/participant-civil-store.mjs",
        "src/lib/participant-kyc-chat-attempt.mjs",
        "src/lib/participant-kyc-chat-closure.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/participant-kyc-notice-links.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs",
        "src/lib/participant-onboarding-authority.mjs",
        "src/lib/participant-onboarding-current-kyc.mjs",
        "src/lib/participant-onboarding-delivery.mjs",
        "src/lib/participant-onboarding-intent.mjs",
        "src/lib/participant-onboarding-policy.mjs",
        "src/lib/participant-onboarding-reactive.mjs",
        "src/lib/participant-policy.mjs",
        "src/lib/participant-store.mjs",
        "src/lib/participant-verified-office.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/pilot-media.mjs",
        "src/lib/plan-baseline-policy.mjs",
        "src/lib/plan-budget-source.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/plan-import-monthly-curve.mjs",
        "src/lib/plan-import-ooxml.mjs",
        "src/lib/plan-import-policy.mjs",
        "src/lib/plan-import-store.mjs",
        "src/lib/plan-measurement-policy.mjs",
        "src/lib/plan-measurement-source.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-consumption-draft.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/whatsapp/field-worker-intent-policy.js",
        "src/lib/whatsapp/obra-intent-policy.js",
        "src/lib/whatsapp/operational-proposal-decision-policy.js",
        "src/lib/whatsapp/project-workspace-profile.js",
        "src/lib/whatsapp/template-review-policy.js",
        "src/lib/whatsapp/tenant-workspace-policy.js",
        "src/lib/worker-channel-consent-policy.mjs",
        "src/lib/worker-channel-identity.mjs",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-store.mjs"
      ],
      "externalImports": [
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "node:zlib",
        "pg",
        "saxes",
        "yauzl"
      ],
      "currentManifest": [
        {
          "path": "package-lock.json",
          "sha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449"
        },
        {
          "path": "package.json",
          "sha256": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d"
        },
        {
          "path": "scripts/fixtures/canonical-participant-kyc.mjs",
          "sha256": "09928b417f3319d76ba34fac91f89a1888f3a8e613bfde3775cac424cc441ccb"
        },
        {
          "path": "scripts/lib/company-channel-disposable-fixture.mjs",
          "sha256": "717d87a6fb1dd7f6a8b2a2d19cd3b2fee652d536e958bd833bf8431c31076138"
        },
        {
          "path": "scripts/lib/disposable-postgres-cleanup.mjs",
          "sha256": "df8d9f36b79cdd5f2d940c0dc4bbc88acbb0bec6e66c9ee5ae93ad5c6e4ab89e"
        },
        {
          "path": "scripts/verify-material-consumption-feedback-postgres.mjs",
          "sha256": "263f778819bcd8edb078b22002781bf257e0febb670ad06a3006528d6df005b4"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/lib/bindx-civil-data-client.mjs",
          "sha256": "20da64b82d14fb3d4055b9852ed8712d33b01d1bc9f50709cb55084c7d0433a2"
        },
        {
          "path": "src/lib/brand-assets.mjs",
          "sha256": "7da49f3f4d8c2f9d2cce36cc2902b5f46e044b98e67bace09e240f5b007fd4c1"
        },
        {
          "path": "src/lib/canonical-invited-account.mjs",
          "sha256": "94652997c4e6717e875041c859de9caaaeeabd9d166666d9dfbf899c51d98c7b"
        },
        {
          "path": "src/lib/company-channel-connection.mjs",
          "sha256": "f2c44860383bb49df67f7999fbe3c0a5aa57c91ebbde0cf9a3b5b367784f2c45"
        },
        {
          "path": "src/lib/company-channel-kyc.mjs",
          "sha256": "5b46276ad3aa5d656a0027be4a6bf58aa3fba4f557dd86e0c13d0d5b0cecba85"
        },
        {
          "path": "src/lib/company-channel-routing.mjs",
          "sha256": "9ed740dbb4ae1ca7d44171f176f0001d824b056a0f17a8f58ed1ea5a5a2e2f68"
        },
        {
          "path": "src/lib/company-channel-schema.mjs",
          "sha256": "96c0385fa3b6d60c8d1f92ca38dcdf32e7779f1200512806bf6d220e6be57022"
        },
        {
          "path": "src/lib/company-entitlement.mjs",
          "sha256": "65d41dfb796ef12be38b1220a99ccd3dfe277419a5e5a27e125beb29fe7e2cde"
        },
        {
          "path": "src/lib/company-onboarding-policy.mjs",
          "sha256": "cf557c7837d6264c78207028c668f8f8a2218f9632a8092cfcb8692ef11053d1"
        },
        {
          "path": "src/lib/company-phone-format.mjs",
          "sha256": "67b31114f517253961c6a774210f157867b1e2e318e6b700089eef03ef1b7209"
        },
        {
          "path": "src/lib/employee-intake-channel-continuity.mjs",
          "sha256": "59dffe3800f26cd979bd12c4cff0010ca72779e1dc62030a6f0117b6ef3fb64d"
        },
        {
          "path": "src/lib/field-hours-report.mjs",
          "sha256": "b55b767d61278bde31cb9ce4ef64faee5320fc7fe1b1bcc54559860bb4576731"
        },
        {
          "path": "src/lib/field-media-privacy.mjs",
          "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
        },
        {
          "path": "src/lib/field-media.mjs",
          "sha256": "d221ab87c4639aadb6eb8788a7203cee072f6eb1deca40605fc3d02742ab9d65"
        },
        {
          "path": "src/lib/field-operations-policy.mjs",
          "sha256": "bb33655b622a081de656f24c2e369fe7a2e05a0a0a9da7ffe455c2f39fd8fbd5"
        },
        {
          "path": "src/lib/field-operations-store.mjs",
          "sha256": "517267adb96c69bce58350b98b3a4e335ca1304a72a824e35998590e95b8987c"
        },
        {
          "path": "src/lib/field-overtime-policy.mjs",
          "sha256": "76848bd0861d6cecccb682b774599f03d3fe1322eed3cc58f5f1db5d9b1e24f8"
        },
        {
          "path": "src/lib/field-overtime-store.mjs",
          "sha256": "f29b67fff29949d5a8b14c4aed3f484ae1ce16d2ed42de486a6d5868361b1526"
        },
        {
          "path": "src/lib/field-report-feedback.mjs",
          "sha256": "70b966ae5f382abe6b5446daf1092c3f66b8f46f80ce5a0c006cffeba1cfa64c"
        },
        {
          "path": "src/lib/field-shift-summary.mjs",
          "sha256": "41f47aa7a0826ba1fe29b554c7575ec60c9861f0c18c863f06e8c3d00cb0f83c"
        },
        {
          "path": "src/lib/geo.js",
          "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
        },
        {
          "path": "src/lib/legacy-access-boundary.js",
          "sha256": "e1af7e83dac3c18bcf3b235d111d936d6dd6167925a3e1459d70a33913035370"
        },
        {
          "path": "src/lib/material-inventory.mjs",
          "sha256": "3af0b0e9c9003d09582ec4e8b21d1e35746dd3839fc7f01071935b9a4ea95333"
        },
        {
          "path": "src/lib/meta-callback-diagnostics.mjs",
          "sha256": "b16fcfbeabe02b119d0337485504490a0c8e60363e841e378ae4c7722816d3bc"
        },
        {
          "path": "src/lib/meta-channel-binding.mjs",
          "sha256": "0ba9e9de3b6dcca46524ab2df22236dbbcd5be5e6cef571df1ec47a01633672e"
        },
        {
          "path": "src/lib/meta-cloud-protocol.mjs",
          "sha256": "c6d5f1e1b4119dd2529860e3bd61a1b22d602f71ad301b2f04cec3ab4bbbed3c"
        },
        {
          "path": "src/lib/meta-consumption-evidence-catalog.mjs",
          "sha256": "cd4eb1ccf8617060aa2bb352cc9467981f7d17649be8b24233413c133c407bff"
        },
        {
          "path": "src/lib/meta-customer-app-projection.mjs",
          "sha256": "7b4b95712f143555a0e23b8ac98fc0e1d2f108e9fbefb4e861d20d9b464ef003"
        },
        {
          "path": "src/lib/meta-customer-callback.mjs",
          "sha256": "da90e3ed097c287a7c080d05daf5e4b0c0bb82544d2f7dab4cb1ee99880c3fd0"
        },
        {
          "path": "src/lib/meta-customer-coexistence.mjs",
          "sha256": "2cf704b2d3842d4ff7ae48a438c1271ad610ccf4e92a6214d97338e91e999c8e"
        },
        {
          "path": "src/lib/meta-customer-credentials.mjs",
          "sha256": "44a05a0b46417de835eb289882b0b2c6d71158f207c16c48228f1ac4b67cca0f"
        },
        {
          "path": "src/lib/meta-customer-inbox-review.mjs",
          "sha256": "250bd69c487dc8dffed5500c1ca0f9adb77843352902c41e4a63da7656bf2eaa"
        },
        {
          "path": "src/lib/meta-customer-outbound.mjs",
          "sha256": "84a249b3777d3be843b20b09d0c6cd81b6fab7415dc22f124477d87475eead09"
        },
        {
          "path": "src/lib/meta-customer-permissions.mjs",
          "sha256": "ce3671bd46af8e487c45319facbca8e6b522620fd16ee3163e5048b5ecb6585d"
        },
        {
          "path": "src/lib/meta-customer-processing.mjs",
          "sha256": "e4a52dbd2ce86793b66c4af5963c288b13d7b2b2f656c4c6f795bcac8074f4ad"
        },
        {
          "path": "src/lib/meta-customer-provider.mjs",
          "sha256": "102ae45ad7d0a1054d2c65cdbfa3a6a96accfcd982bebce8d6c32c7bf24b21a2"
        },
        {
          "path": "src/lib/meta-customer-templates.mjs",
          "sha256": "ca9e491b8b1b4c25c89585408cb53eae13e2423fdf48a93deed0846126e1c46c"
        },
        {
          "path": "src/lib/meta-development-pilot-policy.mjs",
          "sha256": "6f3a854898ea28d108341f35fe7f5f23facf3d574e586b96a2343a8038cc8c79"
        },
        {
          "path": "src/lib/meta-employee-intake.mjs",
          "sha256": "72e80601323adbe35c9ec1f61e49e3428007da55e567c724ca8dce3c42de042b"
        },
        {
          "path": "src/lib/meta-field-bridge.mjs",
          "sha256": "7f3bb80ba828e202f24e1d768b855131642dcc89fde39fcac4b81d64aa632955"
        },
        {
          "path": "src/lib/meta-field-conversation.mjs",
          "sha256": "c68887db8fa04f5806d1c0f4c29e829befb89931b8371041ad65334deb1dab4d"
        },
        {
          "path": "src/lib/meta-kyc-challenge.mjs",
          "sha256": "f5a03ec770e6d85de095393bf38c331c0803a7fe3c7f1b72a2addd9cac7484eb"
        },
        {
          "path": "src/lib/meta-kyc-conversation.mjs",
          "sha256": "17d1e52e826dcaa899e2e6b846e2856c73f73b18b7abfe30e951de0de8623ef6"
        },
        {
          "path": "src/lib/meta-kyc-current-image.mjs",
          "sha256": "03ef3966025f520b373e937a6230f846185f3b4845830da5a38c0d8f02e155c2"
        },
        {
          "path": "src/lib/meta-kyc-identity.mjs",
          "sha256": "295f87ecb3b4586313a4f9c48a2d5c9acf8fa263682d99d44a966be243af2319"
        },
        {
          "path": "src/lib/meta-kyc-rejection-policy.mjs",
          "sha256": "e6c96aba8077d75e152f45dc49fe32d41e103658d4bff4281c8c8a98e3fff0c1"
        },
        {
          "path": "src/lib/meta-kyc-rejection.mjs",
          "sha256": "5477adafd994a54c9e7bbcc196b6af4fbe0b9cc03ab563775b8258290e31f3d0"
        },
        {
          "path": "src/lib/meta-own-company-policy.mjs",
          "sha256": "7db3875cd0f31fec077f4d9a4f8875be1ddf4a5772acff4559069ae950ff0821"
        },
        {
          "path": "src/lib/meta-plan-import-conversation.mjs",
          "sha256": "6f3c261cb2cde943e0202ab5097d664958f5702975cdf5914aeac35e5a1bac1c"
        },
        {
          "path": "src/lib/meta-plan-import-origin.mjs",
          "sha256": "cdb619d1709a982323c9892383def1428db2ade771babdb18e4032b3535d953e"
        },
        {
          "path": "src/lib/meta-plan-import-transport.mjs",
          "sha256": "e42f48f0175dd697bac3de61d7d9893d35c2b1696c1ae276a4698eb3c36a4634"
        },
        {
          "path": "src/lib/meta-test-recipient-binding.mjs",
          "sha256": "2aea6f5815bd2d90fe891b45a79b48d339a3eebc681ac40b3347244e546c4b66"
        },
        {
          "path": "src/lib/meta-whatsapp-transport.mjs",
          "sha256": "f99569c7f587e9be1268aa254d2368226346a7ebf7e48fa6ca63a0064cf41310"
        },
        {
          "path": "src/lib/organization-resource-usage-policy.mjs",
          "sha256": "089ac1ee2ca6afd30aab1d0abd38274698ca56991d1c5225ea8e44c8b9fdc449"
        },
        {
          "path": "src/lib/organization-usage-policy.mjs",
          "sha256": "94997530d6c1fd420f0233172b07f8ba7dd7546a2ac9af75eaa30736400237ae"
        },
        {
          "path": "src/lib/participant-account-discovery.mjs",
          "sha256": "11b37ca397fdb195aac7addc1c16842fb28a9c83a73a82a57bf2791ed3038738"
        },
        {
          "path": "src/lib/participant-admission.mjs",
          "sha256": "2cbb466e49d742cd23da1bb85a4e89b7e411dc724c8d1f2eb66b39717f283dd9"
        },
        {
          "path": "src/lib/participant-analysis-consent.mjs",
          "sha256": "7f7d371914d1e46ac799cd1683afdc0418186c15a20156e697ecd879c81bf8c1"
        },
        {
          "path": "src/lib/participant-approved-identity.mjs",
          "sha256": "834d81e70cedbd967ff84d880ea9d697c2168d2220fb23d9eb14c1aba1cdbbf1"
        },
        {
          "path": "src/lib/participant-bank-account.mjs",
          "sha256": "29980527a6eda3bbc0125098a4b616082034a71fb1afb772ff87f476bc0ce981"
        },
        {
          "path": "src/lib/participant-bank-format.mjs",
          "sha256": "ebbb206a14eaac57230b53ec1afae99c4be60c8739baf0d1d047d4a47ba464db"
        },
        {
          "path": "src/lib/participant-bank-vault.mjs",
          "sha256": "06e990ab79c896628756f3c74a50dcc7e8062f4fa296f56a31e4150b5badc16a"
        },
        {
          "path": "src/lib/participant-channel-kyc.mjs",
          "sha256": "2ac9414429238162a9b16d4adea421df0bff9fb93ea4fbf2f9d6677f2659fb2d"
        },
        {
          "path": "src/lib/participant-civil-policy.mjs",
          "sha256": "e180a64c788d6cd20e766cb4fd32dbba1c7cb3954c01405ac8675ec023eef278"
        },
        {
          "path": "src/lib/participant-civil-store.mjs",
          "sha256": "5f440c0c76ca67b87a7e5d4e90e7a48f18ea3603b16434b35beeddd3bdf168a4"
        },
        {
          "path": "src/lib/participant-kyc-chat-attempt.mjs",
          "sha256": "d3f0a65f866fa027ee008963fcb6ffcad0cd33de94cace7603cf40bc78c21aeb"
        },
        {
          "path": "src/lib/participant-kyc-chat-closure.mjs",
          "sha256": "4a6a368910de95582c2baabc70bab7f4b4afa4413e8ebdb75a1e8b867c098a19"
        },
        {
          "path": "src/lib/participant-kyc-chat-copy.mjs",
          "sha256": "d886219584d5e8b9d9db1ad16a36c726f6982fa0e8400c3be51af2623574ab96"
        },
        {
          "path": "src/lib/participant-kyc-image-set.mjs",
          "sha256": "190ce2560286a58d42668da7b912aeabcfa76ee14086503bf1609304e5f0e8fb"
        },
        {
          "path": "src/lib/participant-kyc-notice-links.mjs",
          "sha256": "3547f3fc2ebdefc2522971467d4c77498160dde7806a25bf9fa18c527c8658fc"
        },
        {
          "path": "src/lib/participant-kyc-preanalysis-policy.mjs",
          "sha256": "8c5286a0a5d41364e92e60f2ce2ba96caccc8667960f966b5caead37acafab49"
        },
        {
          "path": "src/lib/participant-onboarding-authority.mjs",
          "sha256": "dad5d9fd0a61c493ff02331d5333982627cdeb3a7addb74a3c86d44da931f916"
        },
        {
          "path": "src/lib/participant-onboarding-current-kyc.mjs",
          "sha256": "232fecca4f6cf775e5151ec460560e0c1abd6646dc3c532140cabe26dfb42119"
        },
        {
          "path": "src/lib/participant-onboarding-delivery.mjs",
          "sha256": "615592cc1a6215e24c48e8873a27211421853f99ca9093e6f490f77532b3d013"
        },
        {
          "path": "src/lib/participant-onboarding-intent.mjs",
          "sha256": "07114f6066e10617357c4e5d8e2db2b9dc846e5f4cffbc5aef09f2b7bfada9de"
        },
        {
          "path": "src/lib/participant-onboarding-policy.mjs",
          "sha256": "59409797ce3e13b7cfe63fe21d8d7e2c848ee49e0766015939242a9f43687c03"
        },
        {
          "path": "src/lib/participant-onboarding-reactive.mjs",
          "sha256": "666a8c27f3ab7d6fdbe66c91f22ace4e25b04b98e865f401d19c72212916104d"
        },
        {
          "path": "src/lib/participant-policy.mjs",
          "sha256": "7f3969ab1ebac5f01696149d76337199eb64c2fd09015c44c07e8b7e7088d62f"
        },
        {
          "path": "src/lib/participant-store.mjs",
          "sha256": "2296495e366b9ea0c2511066584e93ddf1cff51b5eefd05c6121d2143d78f5c9"
        },
        {
          "path": "src/lib/participant-verified-office.mjs",
          "sha256": "4922f392490aa6d49b8a8a45a56ac0b03831a8ad2efe89ce1e3adfd77d603d89"
        },
        {
          "path": "src/lib/person-worksite-journey.mjs",
          "sha256": "d3174df793150125c0b6a5d9f37d56336e72cab1efb43a361065b78ac54c210a"
        },
        {
          "path": "src/lib/pilot-media.mjs",
          "sha256": "55e35757cea03c312df68cebad100ee8b7d904b418eca9082359ea34e68f8fa9"
        },
        {
          "path": "src/lib/plan-baseline-policy.mjs",
          "sha256": "e9217a41a87057f437439420d56f3b7a0f973ae37c250c07b335634fef308560"
        },
        {
          "path": "src/lib/plan-budget-source.mjs",
          "sha256": "7ebeabf62d8fb89c6ab941b8130d196ca2e008959a9599f2db0c71d75dd3382a"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/plan-import-monthly-curve.mjs",
          "sha256": "6ce785f9c24c47f0e291b0bac40bd96a691fae68a309e4cb7a1917db31f9e6b6"
        },
        {
          "path": "src/lib/plan-import-ooxml.mjs",
          "sha256": "662abaa7523d74961c6873a8b0beb3eb7e3d3b52988fad9cc55e76c0e540a3bd"
        },
        {
          "path": "src/lib/plan-import-policy.mjs",
          "sha256": "1946b2793d0db11519d154acdb5bf0f7e8be5dc26ecd1971b846eed284d7d50f"
        },
        {
          "path": "src/lib/plan-import-store.mjs",
          "sha256": "da047723f790c0f5e7eeff855782e4db7463670d1875caf0bab1c6cce9b1a920"
        },
        {
          "path": "src/lib/plan-measurement-policy.mjs",
          "sha256": "3d6b0bce58a7f89612878310f534d8cf02f6a222c778cd4294b415c1f61157b7"
        },
        {
          "path": "src/lib/plan-measurement-source.mjs",
          "sha256": "ecf33b67a333d8ce73bfb51610218a1658cd94a26b62eb35d2290b795f826f36"
        },
        {
          "path": "src/lib/private-image-upload.mjs",
          "sha256": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60"
        },
        {
          "path": "src/lib/procurement-quantity.js",
          "sha256": "53439844051cc1dbd679220d695e60e54bc1629b2f1ddb33fc125981da9326b3"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/site-register-policy.mjs",
          "sha256": "d529c4f2225e0ec851ef7df60f8c5b182a88b384958ebfd15b194683d1590434"
        },
        {
          "path": "src/lib/site-register-store.mjs",
          "sha256": "6b744c86f47dbb6dc081132675888615d76421701f96151b00646b5e1d2529c6"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/video-audio-extractor.mjs",
          "sha256": "0c85dfd39c10fdb782eca4fe57dc665c29bd7211ab7aba0dda3f8945abcb1988"
        },
        {
          "path": "src/lib/video-frame-extractor.mjs",
          "sha256": "33425a184cf097884982c43a90e3b515726027adbeb51c2cdbfc794e79dee6e6"
        },
        {
          "path": "src/lib/voice-consumption-draft.mjs",
          "sha256": "b9af424825674ca6f24a729e9ba89bae6e67adf433de10837a05e58900584c82"
        },
        {
          "path": "src/lib/voice-progress-draft.mjs",
          "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
        },
        {
          "path": "src/lib/whatsapp/field-worker-intent-policy.js",
          "sha256": "0fdf205af1c2185a16f99c4f1aaba6c36d95722ea914915a0eefe6a10d443ef9"
        },
        {
          "path": "src/lib/whatsapp/obra-intent-policy.js",
          "sha256": "cd01054ba81be6552f58dc91758e08166ea099482f28355cae570d15f3ccf8da"
        },
        {
          "path": "src/lib/whatsapp/operational-proposal-decision-policy.js",
          "sha256": "996ed641c090267679ce0fc3cb7a23f39b31ce88e761135feb0dd0c852eb74fc"
        },
        {
          "path": "src/lib/whatsapp/project-workspace-profile.js",
          "sha256": "e13473baa4ca5b4dc9851bb202f400ba174ccbfce2589be65ce8458aafa998f4"
        },
        {
          "path": "src/lib/whatsapp/template-review-policy.js",
          "sha256": "0ec4a7e544f8c2c2409d2c84ecf69fab663334dd5a5cef0ee1b1cbec82de0a08"
        },
        {
          "path": "src/lib/whatsapp/tenant-workspace-policy.js",
          "sha256": "d3416ff993fbfd70f75404166cdcd8f0b9b2e5a6741f6cde03725aab16abcd5e"
        },
        {
          "path": "src/lib/worker-channel-consent-policy.mjs",
          "sha256": "95c8393e7f2603694c5c15cfe34c9eead43007927aed0d5b633859b14c7448a9"
        },
        {
          "path": "src/lib/worker-channel-identity.mjs",
          "sha256": "1cddd58a2cd656abaca25752481fe1ca760d2bcd385a0fffbe0e685c15d59e0a"
        },
        {
          "path": "src/lib/workspace-policy.mjs",
          "sha256": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e"
        },
        {
          "path": "src/lib/workspace-store.mjs",
          "sha256": "5f25092121a31a06eefa59d69866db82fa3cd28afdcbd0e066e52d916478bc50"
        }
      ]
    },
    {
      "family": "CONSUMPTION_FEEDBACK_UI",
      "previousFiles": [
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/material-inventory-panel.js",
        "src/app/(identity)/cuenta/material-inventory-panel.module.css",
        "src/app/(identity)/cuenta/material-inventory-view.mjs",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/template-send-view.mjs",
        "src/app/(identity)/cuenta/worksite-task-selector.js",
        "src/app/(identity)/cuenta/worksite-task-selector.module.css",
        "src/app/(identity)/cuenta/workspace-live-read.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh.js",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-panel.js",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/app/(identity)/cuenta/workspace.module.css",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs"
      ],
      "previousExternalImports": [
        "react"
      ],
      "currentFiles": [
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/field-media-preview.js",
        "src/app/(identity)/cuenta/field-operations-panel.module.css",
        "src/app/(identity)/cuenta/material-inventory-panel.js",
        "src/app/(identity)/cuenta/material-inventory-panel.module.css",
        "src/app/(identity)/cuenta/material-inventory-view.mjs",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/template-send-view.mjs",
        "src/app/(identity)/cuenta/worksite-task-selector.js",
        "src/app/(identity)/cuenta/worksite-task-selector.module.css",
        "src/app/(identity)/cuenta/workspace-live-read.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh.js",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-panel.js",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/app/(identity)/cuenta/workspace.module.css",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs"
      ],
      "externalImports": [
        "react"
      ],
      "currentManifest": [
        {
          "path": "src/app/(identity)/cuenta/company-channel-view.mjs",
          "sha256": "c79c473999e444b84e2a1d58e0d03f030069c24f9749f2c84450318b0b237e4d"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-preview.js",
          "sha256": "61506157217af690aa3ea649a2472f99acc24ec96aa10eda3cc25d24a8108441"
        },
        {
          "path": "src/app/(identity)/cuenta/field-operations-panel.module.css",
          "sha256": "5ccd8b5beae691b9ab6ee2dc0c0ae876a5fdffe15d31d24c6807f117bd76949c"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-panel.js",
          "sha256": "f910384fa3acc4326037b4a4b0c141c1712cb95845f14d8d975705463fecd2e2"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-panel.module.css",
          "sha256": "1d7eec4afc275ee403674b187acb7844e3df519f24cd537af2e05f7b8032611c"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-view.mjs",
          "sha256": "8942cb9a2f3ed071a77a9e87ca3876fa16b1f819bcb74f395e4307f7c167605a"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-number-view.mjs",
          "sha256": "6940f11e30d2958d7f6771463ce28ca83c0e2d2f41e81aa220c8efe669580300"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-templates-view.mjs",
          "sha256": "3bf758b150336613a437e2b01d3b6a79645a024b771f1515f4ec2ae58a1b8bc3"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-office-account-view.mjs",
          "sha256": "f2716f72297a1277946bafa03a82d4c1fb7f2fcff7f4c4bbe155a86ed7e4e379"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline-view.mjs",
          "sha256": "0c696eba748a7441440e23be5085dc42d4954427def5adc1e2de686b4b11711d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.mjs",
          "sha256": "689402d373744d159a62e2e5975ddfdf79053c528a838879dd5df3e43a0efdc9"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-view.mjs",
          "sha256": "58ebd978e8e39423901cb811ecf2ab851160b78f7cd5cb441075d66d7819dee9"
        },
        {
          "path": "src/app/(identity)/cuenta/template-send-view.mjs",
          "sha256": "703415b8dab1a575ebb54c9273049d2b940f93994add7177255ae26918672940"
        },
        {
          "path": "src/app/(identity)/cuenta/worksite-task-selector.js",
          "sha256": "d790aeec929ed1ef2ac724883988b03f6640f3882133d917760f0ddeb2a2488c"
        },
        {
          "path": "src/app/(identity)/cuenta/worksite-task-selector.module.css",
          "sha256": "12351228e827ea0e9a42a45f4d40a3fb713edd01bf0aab3ab6f58efbde7fa434"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-read.mjs",
          "sha256": "a73e558f46b86a78cbe4f22783403af17061fe03e79f8e184f967448041909ec"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
          "sha256": "a61c2d017bc8dadb79fab4b0630b0404b65132d355e153bcb6a2042f5fd49511"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-refresh.js",
          "sha256": "78b056667e89f56fd9e1185c3addc6a8d40b331a0cd82146cbba17771662510a"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
          "sha256": "3a8d1c517fb084df425198c84671f6b76bb1f659f9d0d4ed94945cd1046d8e64"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-panel.js",
          "sha256": "063361bf78293a61a246195d5734f69a17b08c5781ae5c9f502b85dcc51ef883"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
          "sha256": "d8cf1e7e8d88d66f722aaf52deb45f95829c226468d3f37a2b23d171cc1ecbb8"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
          "sha256": "b3004538de2cc7cbc829bf5518c4f4b2a5eb2935d0b4e60f9c88840c8ede3797"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
          "sha256": "590cd7691d8b6beb82929bdd18dd9909c2d2cfa1c3d4111ff4d478d57daf532f"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-session-request.mjs",
          "sha256": "29d294ac1d973317d6a3df225a64a8a9115c6ea51c587f297114e7992af97520"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace.module.css",
          "sha256": "dfce6eb468fee571af0d0f371e68848274f22198faf89c0a6cdd5df5edc7e7a9"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        }
      ]
    },
    {
      "family": "COMPACT",
      "previousFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/company-channel-disposable-fixture.mjs",
        "scripts/lib/company-channel-migration.mjs",
        "scripts/lib/disposable-postgres-cleanup.mjs",
        "scripts/lib/kyc-current-image-native.mjs",
        "scripts/lib/kyc-current-image-own-native.mjs",
        "scripts/lib/kyc-neutral-step-guidance-native.mjs",
        "scripts/lib/kyc-neutral-step-guidance-own-native.mjs",
        "scripts/verify-company-kyc-outbound-compact-postgres.mjs",
        "scripts/verify-company-kyc-rejection-feedback-postgres.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/lib/bindx-civil-data-client.mjs",
        "src/lib/brand-assets.mjs",
        "src/lib/canonical-invited-account.mjs",
        "src/lib/company-channel-connection.mjs",
        "src/lib/company-channel-kyc.mjs",
        "src/lib/company-channel-routing.mjs",
        "src/lib/company-channel-schema.mjs",
        "src/lib/company-channel-store.mjs",
        "src/lib/company-entitlement.mjs",
        "src/lib/company-onboarding-policy.mjs",
        "src/lib/company-phone-format.mjs",
        "src/lib/employee-intake-channel-continuity.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/legacy-access-boundary.js",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-callback-diagnostics.mjs",
        "src/lib/meta-channel-binding.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/meta-customer-app-projection.mjs",
        "src/lib/meta-customer-callback.mjs",
        "src/lib/meta-customer-coexistence.mjs",
        "src/lib/meta-customer-credentials.mjs",
        "src/lib/meta-customer-inbox-review.mjs",
        "src/lib/meta-customer-outbound.mjs",
        "src/lib/meta-customer-permissions.mjs",
        "src/lib/meta-customer-processing-runtime.mjs",
        "src/lib/meta-customer-processing.mjs",
        "src/lib/meta-customer-provider.mjs",
        "src/lib/meta-customer-templates.mjs",
        "src/lib/meta-development-pilot-policy.mjs",
        "src/lib/meta-employee-intake.mjs",
        "src/lib/meta-field-bridge.mjs",
        "src/lib/meta-field-conversation.mjs",
        "src/lib/meta-kyc-bridge.mjs",
        "src/lib/meta-kyc-challenge.mjs",
        "src/lib/meta-kyc-context-feedback.mjs",
        "src/lib/meta-kyc-context-outbound.mjs",
        "src/lib/meta-kyc-conversation.mjs",
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/meta-kyc-expiry-feedback.mjs",
        "src/lib/meta-kyc-identity.mjs",
        "src/lib/meta-kyc-outbound.mjs",
        "src/lib/meta-kyc-rejection-policy.mjs",
        "src/lib/meta-kyc-rejection.mjs",
        "src/lib/meta-own-company-connection.mjs",
        "src/lib/meta-own-company-policy.mjs",
        "src/lib/meta-plan-import-conversation.mjs",
        "src/lib/meta-plan-import-origin.mjs",
        "src/lib/meta-plan-import-recovery.mjs",
        "src/lib/meta-plan-import-transport.mjs",
        "src/lib/meta-test-recipient-binding.mjs",
        "src/lib/meta-whatsapp-transport.mjs",
        "src/lib/organization-resource-usage-policy.mjs",
        "src/lib/organization-resource-usage-store.mjs",
        "src/lib/organization-usage-policy.mjs",
        "src/lib/organization-usage-runtime.mjs",
        "src/lib/organization-usage-store.mjs",
        "src/lib/participant-account-discovery.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-bank-account.mjs",
        "src/lib/participant-bank-format.mjs",
        "src/lib/participant-bank-vault.mjs",
        "src/lib/participant-channel-kyc.mjs",
        "src/lib/participant-civil-policy.mjs",
        "src/lib/participant-civil-store.mjs",
        "src/lib/participant-kyc-chat-attempt.mjs",
        "src/lib/participant-kyc-chat-closure.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/participant-kyc-notice-links.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs",
        "src/lib/participant-kyc-preanalysis-runtime.mjs",
        "src/lib/participant-kyc-preanalysis.mjs",
        "src/lib/participant-onboarding-authority.mjs",
        "src/lib/participant-onboarding-current-kyc.mjs",
        "src/lib/participant-onboarding-delivery.mjs",
        "src/lib/participant-onboarding-intent.mjs",
        "src/lib/participant-onboarding-policy.mjs",
        "src/lib/participant-onboarding-reactive.mjs",
        "src/lib/participant-policy.mjs",
        "src/lib/participant-store.mjs",
        "src/lib/participant-verified-office.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/pilot-media.mjs",
        "src/lib/plan-baseline-policy.mjs",
        "src/lib/plan-import-analyzer.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/plan-import-monthly-curve.mjs",
        "src/lib/plan-import-ooxml.mjs",
        "src/lib/plan-import-policy.mjs",
        "src/lib/plan-import-store.mjs",
        "src/lib/plan-measurement-policy.mjs",
        "src/lib/plan-measurement-source.mjs",
        "src/lib/private-biometric-analyzer.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/whatsapp/field-worker-intent-policy.js",
        "src/lib/whatsapp/obra-intent-policy.js",
        "src/lib/whatsapp/operational-proposal-decision-policy.js",
        "src/lib/whatsapp/project-workspace-profile.js",
        "src/lib/whatsapp/template-review-policy.js",
        "src/lib/whatsapp/tenant-workspace-policy.js",
        "src/lib/worker-channel-consent-policy.mjs",
        "src/lib/worker-channel-identity.mjs",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-runtime.mjs",
        "src/lib/workspace-store.mjs",
        "tests/fixtures/meta-kyc-outbound-baseline-b572.json",
        "tests/fixtures/own-company-meta.mjs"
      ],
      "previousExternalImports": [
        "@babel/parser",
        "@vercel/blob",
        "ffmpeg-static",
        "next/server",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "node:zlib",
        "pg",
        "saxes",
        "yauzl"
      ],
      "currentFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/company-channel-disposable-fixture.mjs",
        "scripts/lib/company-channel-migration.mjs",
        "scripts/lib/disposable-postgres-cleanup.mjs",
        "scripts/lib/kyc-current-image-native.mjs",
        "scripts/lib/kyc-current-image-own-native.mjs",
        "scripts/lib/kyc-neutral-step-guidance-native.mjs",
        "scripts/lib/kyc-neutral-step-guidance-own-native.mjs",
        "scripts/verify-company-kyc-outbound-compact-postgres.mjs",
        "scripts/verify-company-kyc-rejection-feedback-postgres.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/lib/bindx-civil-data-client.mjs",
        "src/lib/brand-assets.mjs",
        "src/lib/canonical-invited-account.mjs",
        "src/lib/company-channel-connection.mjs",
        "src/lib/company-channel-kyc.mjs",
        "src/lib/company-channel-routing.mjs",
        "src/lib/company-channel-schema.mjs",
        "src/lib/company-channel-store.mjs",
        "src/lib/company-entitlement.mjs",
        "src/lib/company-onboarding-policy.mjs",
        "src/lib/company-phone-format.mjs",
        "src/lib/employee-intake-channel-continuity.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/legacy-access-boundary.js",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-callback-diagnostics.mjs",
        "src/lib/meta-channel-binding.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/meta-consumption-evidence-catalog.mjs",
        "src/lib/meta-customer-app-projection.mjs",
        "src/lib/meta-customer-callback.mjs",
        "src/lib/meta-customer-coexistence.mjs",
        "src/lib/meta-customer-credentials.mjs",
        "src/lib/meta-customer-inbox-review.mjs",
        "src/lib/meta-customer-outbound.mjs",
        "src/lib/meta-customer-permissions.mjs",
        "src/lib/meta-customer-processing-runtime.mjs",
        "src/lib/meta-customer-processing.mjs",
        "src/lib/meta-customer-provider.mjs",
        "src/lib/meta-customer-templates.mjs",
        "src/lib/meta-development-pilot-policy.mjs",
        "src/lib/meta-employee-intake.mjs",
        "src/lib/meta-field-bridge.mjs",
        "src/lib/meta-field-conversation.mjs",
        "src/lib/meta-kyc-bridge.mjs",
        "src/lib/meta-kyc-challenge.mjs",
        "src/lib/meta-kyc-context-feedback.mjs",
        "src/lib/meta-kyc-context-outbound.mjs",
        "src/lib/meta-kyc-conversation.mjs",
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/meta-kyc-expiry-feedback.mjs",
        "src/lib/meta-kyc-identity.mjs",
        "src/lib/meta-kyc-outbound.mjs",
        "src/lib/meta-kyc-rejection-policy.mjs",
        "src/lib/meta-kyc-rejection.mjs",
        "src/lib/meta-own-company-connection.mjs",
        "src/lib/meta-own-company-policy.mjs",
        "src/lib/meta-plan-import-conversation.mjs",
        "src/lib/meta-plan-import-origin.mjs",
        "src/lib/meta-plan-import-recovery.mjs",
        "src/lib/meta-plan-import-transport.mjs",
        "src/lib/meta-test-recipient-binding.mjs",
        "src/lib/meta-whatsapp-transport.mjs",
        "src/lib/organization-resource-usage-policy.mjs",
        "src/lib/organization-resource-usage-store.mjs",
        "src/lib/organization-usage-policy.mjs",
        "src/lib/organization-usage-runtime.mjs",
        "src/lib/organization-usage-store.mjs",
        "src/lib/participant-account-discovery.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-bank-account.mjs",
        "src/lib/participant-bank-format.mjs",
        "src/lib/participant-bank-vault.mjs",
        "src/lib/participant-channel-kyc.mjs",
        "src/lib/participant-civil-policy.mjs",
        "src/lib/participant-civil-store.mjs",
        "src/lib/participant-kyc-chat-attempt.mjs",
        "src/lib/participant-kyc-chat-closure.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/participant-kyc-notice-links.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs",
        "src/lib/participant-kyc-preanalysis-runtime.mjs",
        "src/lib/participant-kyc-preanalysis.mjs",
        "src/lib/participant-onboarding-authority.mjs",
        "src/lib/participant-onboarding-current-kyc.mjs",
        "src/lib/participant-onboarding-delivery.mjs",
        "src/lib/participant-onboarding-intent.mjs",
        "src/lib/participant-onboarding-policy.mjs",
        "src/lib/participant-onboarding-reactive.mjs",
        "src/lib/participant-policy.mjs",
        "src/lib/participant-store.mjs",
        "src/lib/participant-verified-office.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/pilot-media.mjs",
        "src/lib/plan-baseline-policy.mjs",
        "src/lib/plan-budget-source.mjs",
        "src/lib/plan-import-analyzer.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/plan-import-monthly-curve.mjs",
        "src/lib/plan-import-ooxml.mjs",
        "src/lib/plan-import-policy.mjs",
        "src/lib/plan-import-store.mjs",
        "src/lib/plan-measurement-policy.mjs",
        "src/lib/plan-measurement-source.mjs",
        "src/lib/private-biometric-analyzer.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-consumption-draft.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/whatsapp/field-worker-intent-policy.js",
        "src/lib/whatsapp/obra-intent-policy.js",
        "src/lib/whatsapp/operational-proposal-decision-policy.js",
        "src/lib/whatsapp/project-workspace-profile.js",
        "src/lib/whatsapp/template-review-policy.js",
        "src/lib/whatsapp/tenant-workspace-policy.js",
        "src/lib/worker-channel-consent-policy.mjs",
        "src/lib/worker-channel-identity.mjs",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-runtime.mjs",
        "src/lib/workspace-store.mjs",
        "tests/fixtures/meta-kyc-outbound-baseline-b572.json",
        "tests/fixtures/own-company-meta.mjs"
      ],
      "externalImports": [
        "@babel/parser",
        "@vercel/blob",
        "ffmpeg-static",
        "next/server",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "node:zlib",
        "pg",
        "saxes",
        "yauzl"
      ],
      "currentManifest": [
        {
          "path": "package-lock.json",
          "sha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449"
        },
        {
          "path": "package.json",
          "sha256": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d"
        },
        {
          "path": "scripts/lib/company-channel-disposable-fixture.mjs",
          "sha256": "717d87a6fb1dd7f6a8b2a2d19cd3b2fee652d536e958bd833bf8431c31076138"
        },
        {
          "path": "scripts/lib/company-channel-migration.mjs",
          "sha256": "1ffb93c704636434f36b52367d3d21d8615ce9b516f350956c414c917e9d33c7"
        },
        {
          "path": "scripts/lib/disposable-postgres-cleanup.mjs",
          "sha256": "df8d9f36b79cdd5f2d940c0dc4bbc88acbb0bec6e66c9ee5ae93ad5c6e4ab89e"
        },
        {
          "path": "scripts/lib/kyc-current-image-native.mjs",
          "sha256": "87ad6932bbb4ed264947b0ba527965080e4f38a7cc0bb0f945b471e88ee06bbb"
        },
        {
          "path": "scripts/lib/kyc-current-image-own-native.mjs",
          "sha256": "2458c91bda08fe36d409e9c229c19f06dfe9d113aa8c8df4d6f11502b0d1e5fe"
        },
        {
          "path": "scripts/lib/kyc-neutral-step-guidance-native.mjs",
          "sha256": "ddfd08e00f35b3f33254eed513d7bba81ec9791b23ca0d078362132fd24d546e"
        },
        {
          "path": "scripts/lib/kyc-neutral-step-guidance-own-native.mjs",
          "sha256": "8e417c9d93d3a265b7ea7dc34b81737454286b573fd3738a6cfc37f0a5520955"
        },
        {
          "path": "scripts/verify-company-kyc-outbound-compact-postgres.mjs",
          "sha256": "362bdcc31bf9eb37197e3c21485dd6522ab3343ea2d01d9fe1db4b3f27b56700"
        },
        {
          "path": "scripts/verify-company-kyc-rejection-feedback-postgres.mjs",
          "sha256": "a64cd0fa267dda98f9c9430327ab39f2cfec304fadc7fddb6c804ba41091ba32"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/lib/bindx-civil-data-client.mjs",
          "sha256": "20da64b82d14fb3d4055b9852ed8712d33b01d1bc9f50709cb55084c7d0433a2"
        },
        {
          "path": "src/lib/brand-assets.mjs",
          "sha256": "7da49f3f4d8c2f9d2cce36cc2902b5f46e044b98e67bace09e240f5b007fd4c1"
        },
        {
          "path": "src/lib/canonical-invited-account.mjs",
          "sha256": "94652997c4e6717e875041c859de9caaaeeabd9d166666d9dfbf899c51d98c7b"
        },
        {
          "path": "src/lib/company-channel-connection.mjs",
          "sha256": "f2c44860383bb49df67f7999fbe3c0a5aa57c91ebbde0cf9a3b5b367784f2c45"
        },
        {
          "path": "src/lib/company-channel-kyc.mjs",
          "sha256": "5b46276ad3aa5d656a0027be4a6bf58aa3fba4f557dd86e0c13d0d5b0cecba85"
        },
        {
          "path": "src/lib/company-channel-routing.mjs",
          "sha256": "9ed740dbb4ae1ca7d44171f176f0001d824b056a0f17a8f58ed1ea5a5a2e2f68"
        },
        {
          "path": "src/lib/company-channel-schema.mjs",
          "sha256": "96c0385fa3b6d60c8d1f92ca38dcdf32e7779f1200512806bf6d220e6be57022"
        },
        {
          "path": "src/lib/company-channel-store.mjs",
          "sha256": "300c5e7e0abe65b97b86a200c6cc72444b9c65ce375d61975c56f5abbc6a453b"
        },
        {
          "path": "src/lib/company-entitlement.mjs",
          "sha256": "65d41dfb796ef12be38b1220a99ccd3dfe277419a5e5a27e125beb29fe7e2cde"
        },
        {
          "path": "src/lib/company-onboarding-policy.mjs",
          "sha256": "cf557c7837d6264c78207028c668f8f8a2218f9632a8092cfcb8692ef11053d1"
        },
        {
          "path": "src/lib/company-phone-format.mjs",
          "sha256": "67b31114f517253961c6a774210f157867b1e2e318e6b700089eef03ef1b7209"
        },
        {
          "path": "src/lib/employee-intake-channel-continuity.mjs",
          "sha256": "59dffe3800f26cd979bd12c4cff0010ca72779e1dc62030a6f0117b6ef3fb64d"
        },
        {
          "path": "src/lib/field-hours-report.mjs",
          "sha256": "b55b767d61278bde31cb9ce4ef64faee5320fc7fe1b1bcc54559860bb4576731"
        },
        {
          "path": "src/lib/field-media-privacy.mjs",
          "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
        },
        {
          "path": "src/lib/field-media.mjs",
          "sha256": "d221ab87c4639aadb6eb8788a7203cee072f6eb1deca40605fc3d02742ab9d65"
        },
        {
          "path": "src/lib/field-operations-policy.mjs",
          "sha256": "bb33655b622a081de656f24c2e369fe7a2e05a0a0a9da7ffe455c2f39fd8fbd5"
        },
        {
          "path": "src/lib/field-operations-store.mjs",
          "sha256": "517267adb96c69bce58350b98b3a4e335ca1304a72a824e35998590e95b8987c"
        },
        {
          "path": "src/lib/field-overtime-policy.mjs",
          "sha256": "76848bd0861d6cecccb682b774599f03d3fe1322eed3cc58f5f1db5d9b1e24f8"
        },
        {
          "path": "src/lib/field-overtime-store.mjs",
          "sha256": "f29b67fff29949d5a8b14c4aed3f484ae1ce16d2ed42de486a6d5868361b1526"
        },
        {
          "path": "src/lib/field-report-feedback.mjs",
          "sha256": "70b966ae5f382abe6b5446daf1092c3f66b8f46f80ce5a0c006cffeba1cfa64c"
        },
        {
          "path": "src/lib/field-shift-summary.mjs",
          "sha256": "41f47aa7a0826ba1fe29b554c7575ec60c9861f0c18c863f06e8c3d00cb0f83c"
        },
        {
          "path": "src/lib/geo.js",
          "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
        },
        {
          "path": "src/lib/legacy-access-boundary.js",
          "sha256": "e1af7e83dac3c18bcf3b235d111d936d6dd6167925a3e1459d70a33913035370"
        },
        {
          "path": "src/lib/material-inventory.mjs",
          "sha256": "3af0b0e9c9003d09582ec4e8b21d1e35746dd3839fc7f01071935b9a4ea95333"
        },
        {
          "path": "src/lib/meta-callback-diagnostics.mjs",
          "sha256": "b16fcfbeabe02b119d0337485504490a0c8e60363e841e378ae4c7722816d3bc"
        },
        {
          "path": "src/lib/meta-channel-binding.mjs",
          "sha256": "0ba9e9de3b6dcca46524ab2df22236dbbcd5be5e6cef571df1ec47a01633672e"
        },
        {
          "path": "src/lib/meta-cloud-protocol.mjs",
          "sha256": "c6d5f1e1b4119dd2529860e3bd61a1b22d602f71ad301b2f04cec3ab4bbbed3c"
        },
        {
          "path": "src/lib/meta-consumption-evidence-catalog.mjs",
          "sha256": "cd4eb1ccf8617060aa2bb352cc9467981f7d17649be8b24233413c133c407bff"
        },
        {
          "path": "src/lib/meta-customer-app-projection.mjs",
          "sha256": "7b4b95712f143555a0e23b8ac98fc0e1d2f108e9fbefb4e861d20d9b464ef003"
        },
        {
          "path": "src/lib/meta-customer-callback.mjs",
          "sha256": "da90e3ed097c287a7c080d05daf5e4b0c0bb82544d2f7dab4cb1ee99880c3fd0"
        },
        {
          "path": "src/lib/meta-customer-coexistence.mjs",
          "sha256": "2cf704b2d3842d4ff7ae48a438c1271ad610ccf4e92a6214d97338e91e999c8e"
        },
        {
          "path": "src/lib/meta-customer-credentials.mjs",
          "sha256": "44a05a0b46417de835eb289882b0b2c6d71158f207c16c48228f1ac4b67cca0f"
        },
        {
          "path": "src/lib/meta-customer-inbox-review.mjs",
          "sha256": "250bd69c487dc8dffed5500c1ca0f9adb77843352902c41e4a63da7656bf2eaa"
        },
        {
          "path": "src/lib/meta-customer-outbound.mjs",
          "sha256": "84a249b3777d3be843b20b09d0c6cd81b6fab7415dc22f124477d87475eead09"
        },
        {
          "path": "src/lib/meta-customer-permissions.mjs",
          "sha256": "ce3671bd46af8e487c45319facbca8e6b522620fd16ee3163e5048b5ecb6585d"
        },
        {
          "path": "src/lib/meta-customer-processing-runtime.mjs",
          "sha256": "68c0712464738bff2abfdd9e7310266056b7685bb22976b21e3ce325082a0fdd"
        },
        {
          "path": "src/lib/meta-customer-processing.mjs",
          "sha256": "e4a52dbd2ce86793b66c4af5963c288b13d7b2b2f656c4c6f795bcac8074f4ad"
        },
        {
          "path": "src/lib/meta-customer-provider.mjs",
          "sha256": "102ae45ad7d0a1054d2c65cdbfa3a6a96accfcd982bebce8d6c32c7bf24b21a2"
        },
        {
          "path": "src/lib/meta-customer-templates.mjs",
          "sha256": "ca9e491b8b1b4c25c89585408cb53eae13e2423fdf48a93deed0846126e1c46c"
        },
        {
          "path": "src/lib/meta-development-pilot-policy.mjs",
          "sha256": "6f3a854898ea28d108341f35fe7f5f23facf3d574e586b96a2343a8038cc8c79"
        },
        {
          "path": "src/lib/meta-employee-intake.mjs",
          "sha256": "72e80601323adbe35c9ec1f61e49e3428007da55e567c724ca8dce3c42de042b"
        },
        {
          "path": "src/lib/meta-field-bridge.mjs",
          "sha256": "7f3bb80ba828e202f24e1d768b855131642dcc89fde39fcac4b81d64aa632955"
        },
        {
          "path": "src/lib/meta-field-conversation.mjs",
          "sha256": "c68887db8fa04f5806d1c0f4c29e829befb89931b8371041ad65334deb1dab4d"
        },
        {
          "path": "src/lib/meta-kyc-bridge.mjs",
          "sha256": "33368028c42baf9f720390de4fc03cbed1448368079415850a41f3adadfebed3"
        },
        {
          "path": "src/lib/meta-kyc-challenge.mjs",
          "sha256": "f5a03ec770e6d85de095393bf38c331c0803a7fe3c7f1b72a2addd9cac7484eb"
        },
        {
          "path": "src/lib/meta-kyc-context-feedback.mjs",
          "sha256": "c8e549ba41e57e637e754e0bef5cd52c2e14a96bab5400f598e4e5aff2249668"
        },
        {
          "path": "src/lib/meta-kyc-context-outbound.mjs",
          "sha256": "cdcf9465f36960b9b9c1252733f7b063538adfe3d4d0b4b15faef5f0d4a0bbfc"
        },
        {
          "path": "src/lib/meta-kyc-conversation.mjs",
          "sha256": "17d1e52e826dcaa899e2e6b846e2856c73f73b18b7abfe30e951de0de8623ef6"
        },
        {
          "path": "src/lib/meta-kyc-current-image.mjs",
          "sha256": "03ef3966025f520b373e937a6230f846185f3b4845830da5a38c0d8f02e155c2"
        },
        {
          "path": "src/lib/meta-kyc-expiry-feedback.mjs",
          "sha256": "9734d647efc6daa72a2a69072d698f05d1edf3a0795b7476df4498aa1328e5a7"
        },
        {
          "path": "src/lib/meta-kyc-identity.mjs",
          "sha256": "295f87ecb3b4586313a4f9c48a2d5c9acf8fa263682d99d44a966be243af2319"
        },
        {
          "path": "src/lib/meta-kyc-outbound.mjs",
          "sha256": "e0766080e345b3777fc87a6f8014a34073beb48a3c9205aa4c1cb49251b4e589"
        },
        {
          "path": "src/lib/meta-kyc-rejection-policy.mjs",
          "sha256": "e6c96aba8077d75e152f45dc49fe32d41e103658d4bff4281c8c8a98e3fff0c1"
        },
        {
          "path": "src/lib/meta-kyc-rejection.mjs",
          "sha256": "5477adafd994a54c9e7bbcc196b6af4fbe0b9cc03ab563775b8258290e31f3d0"
        },
        {
          "path": "src/lib/meta-own-company-connection.mjs",
          "sha256": "5bdf8a2c6b1333efe0a12481174e433cd58c9e1583ae0972f4cb090892eaaf84"
        },
        {
          "path": "src/lib/meta-own-company-policy.mjs",
          "sha256": "7db3875cd0f31fec077f4d9a4f8875be1ddf4a5772acff4559069ae950ff0821"
        },
        {
          "path": "src/lib/meta-plan-import-conversation.mjs",
          "sha256": "6f3c261cb2cde943e0202ab5097d664958f5702975cdf5914aeac35e5a1bac1c"
        },
        {
          "path": "src/lib/meta-plan-import-origin.mjs",
          "sha256": "cdb619d1709a982323c9892383def1428db2ade771babdb18e4032b3535d953e"
        },
        {
          "path": "src/lib/meta-plan-import-recovery.mjs",
          "sha256": "01b77db7aba4a2d1736bf952f2056d95163d66dbb4f9e2ef8172bf41b756b23e"
        },
        {
          "path": "src/lib/meta-plan-import-transport.mjs",
          "sha256": "e42f48f0175dd697bac3de61d7d9893d35c2b1696c1ae276a4698eb3c36a4634"
        },
        {
          "path": "src/lib/meta-test-recipient-binding.mjs",
          "sha256": "2aea6f5815bd2d90fe891b45a79b48d339a3eebc681ac40b3347244e546c4b66"
        },
        {
          "path": "src/lib/meta-whatsapp-transport.mjs",
          "sha256": "f99569c7f587e9be1268aa254d2368226346a7ebf7e48fa6ca63a0064cf41310"
        },
        {
          "path": "src/lib/organization-resource-usage-policy.mjs",
          "sha256": "089ac1ee2ca6afd30aab1d0abd38274698ca56991d1c5225ea8e44c8b9fdc449"
        },
        {
          "path": "src/lib/organization-resource-usage-store.mjs",
          "sha256": "869502cd3b11d1625c4dbb843ebc53d92e43dd21d13fcb53f22538684ec4f2ef"
        },
        {
          "path": "src/lib/organization-usage-policy.mjs",
          "sha256": "94997530d6c1fd420f0233172b07f8ba7dd7546a2ac9af75eaa30736400237ae"
        },
        {
          "path": "src/lib/organization-usage-runtime.mjs",
          "sha256": "b9288de2dd937db0bffb9e9e5a8da08773f9a6e35d139713b98f925e462a5bc9"
        },
        {
          "path": "src/lib/organization-usage-store.mjs",
          "sha256": "9497c32b76ffda1d5456267d4fcdc90b674618df1d60bd84dbbd7bc3b2827347"
        },
        {
          "path": "src/lib/participant-account-discovery.mjs",
          "sha256": "11b37ca397fdb195aac7addc1c16842fb28a9c83a73a82a57bf2791ed3038738"
        },
        {
          "path": "src/lib/participant-admission.mjs",
          "sha256": "2cbb466e49d742cd23da1bb85a4e89b7e411dc724c8d1f2eb66b39717f283dd9"
        },
        {
          "path": "src/lib/participant-analysis-consent.mjs",
          "sha256": "7f7d371914d1e46ac799cd1683afdc0418186c15a20156e697ecd879c81bf8c1"
        },
        {
          "path": "src/lib/participant-approved-identity.mjs",
          "sha256": "834d81e70cedbd967ff84d880ea9d697c2168d2220fb23d9eb14c1aba1cdbbf1"
        },
        {
          "path": "src/lib/participant-bank-account.mjs",
          "sha256": "29980527a6eda3bbc0125098a4b616082034a71fb1afb772ff87f476bc0ce981"
        },
        {
          "path": "src/lib/participant-bank-format.mjs",
          "sha256": "ebbb206a14eaac57230b53ec1afae99c4be60c8739baf0d1d047d4a47ba464db"
        },
        {
          "path": "src/lib/participant-bank-vault.mjs",
          "sha256": "06e990ab79c896628756f3c74a50dcc7e8062f4fa296f56a31e4150b5badc16a"
        },
        {
          "path": "src/lib/participant-channel-kyc.mjs",
          "sha256": "2ac9414429238162a9b16d4adea421df0bff9fb93ea4fbf2f9d6677f2659fb2d"
        },
        {
          "path": "src/lib/participant-civil-policy.mjs",
          "sha256": "e180a64c788d6cd20e766cb4fd32dbba1c7cb3954c01405ac8675ec023eef278"
        },
        {
          "path": "src/lib/participant-civil-store.mjs",
          "sha256": "5f440c0c76ca67b87a7e5d4e90e7a48f18ea3603b16434b35beeddd3bdf168a4"
        },
        {
          "path": "src/lib/participant-kyc-chat-attempt.mjs",
          "sha256": "d3f0a65f866fa027ee008963fcb6ffcad0cd33de94cace7603cf40bc78c21aeb"
        },
        {
          "path": "src/lib/participant-kyc-chat-closure.mjs",
          "sha256": "4a6a368910de95582c2baabc70bab7f4b4afa4413e8ebdb75a1e8b867c098a19"
        },
        {
          "path": "src/lib/participant-kyc-chat-copy.mjs",
          "sha256": "d886219584d5e8b9d9db1ad16a36c726f6982fa0e8400c3be51af2623574ab96"
        },
        {
          "path": "src/lib/participant-kyc-image-set.mjs",
          "sha256": "190ce2560286a58d42668da7b912aeabcfa76ee14086503bf1609304e5f0e8fb"
        },
        {
          "path": "src/lib/participant-kyc-notice-links.mjs",
          "sha256": "3547f3fc2ebdefc2522971467d4c77498160dde7806a25bf9fa18c527c8658fc"
        },
        {
          "path": "src/lib/participant-kyc-preanalysis-policy.mjs",
          "sha256": "8c5286a0a5d41364e92e60f2ce2ba96caccc8667960f966b5caead37acafab49"
        },
        {
          "path": "src/lib/participant-kyc-preanalysis-runtime.mjs",
          "sha256": "ac91e8a9a0fbb559cbdb143daf8806217ece06f969140e4f0858cc3d759f40a3"
        },
        {
          "path": "src/lib/participant-kyc-preanalysis.mjs",
          "sha256": "4032950ecce3fd910225261d3e268160feb63893bc7d13a0f673b9e3d5d4fc87"
        },
        {
          "path": "src/lib/participant-onboarding-authority.mjs",
          "sha256": "dad5d9fd0a61c493ff02331d5333982627cdeb3a7addb74a3c86d44da931f916"
        },
        {
          "path": "src/lib/participant-onboarding-current-kyc.mjs",
          "sha256": "232fecca4f6cf775e5151ec460560e0c1abd6646dc3c532140cabe26dfb42119"
        },
        {
          "path": "src/lib/participant-onboarding-delivery.mjs",
          "sha256": "615592cc1a6215e24c48e8873a27211421853f99ca9093e6f490f77532b3d013"
        },
        {
          "path": "src/lib/participant-onboarding-intent.mjs",
          "sha256": "07114f6066e10617357c4e5d8e2db2b9dc846e5f4cffbc5aef09f2b7bfada9de"
        },
        {
          "path": "src/lib/participant-onboarding-policy.mjs",
          "sha256": "59409797ce3e13b7cfe63fe21d8d7e2c848ee49e0766015939242a9f43687c03"
        },
        {
          "path": "src/lib/participant-onboarding-reactive.mjs",
          "sha256": "666a8c27f3ab7d6fdbe66c91f22ace4e25b04b98e865f401d19c72212916104d"
        },
        {
          "path": "src/lib/participant-policy.mjs",
          "sha256": "7f3969ab1ebac5f01696149d76337199eb64c2fd09015c44c07e8b7e7088d62f"
        },
        {
          "path": "src/lib/participant-store.mjs",
          "sha256": "2296495e366b9ea0c2511066584e93ddf1cff51b5eefd05c6121d2143d78f5c9"
        },
        {
          "path": "src/lib/participant-verified-office.mjs",
          "sha256": "4922f392490aa6d49b8a8a45a56ac0b03831a8ad2efe89ce1e3adfd77d603d89"
        },
        {
          "path": "src/lib/person-worksite-journey.mjs",
          "sha256": "d3174df793150125c0b6a5d9f37d56336e72cab1efb43a361065b78ac54c210a"
        },
        {
          "path": "src/lib/pilot-media.mjs",
          "sha256": "55e35757cea03c312df68cebad100ee8b7d904b418eca9082359ea34e68f8fa9"
        },
        {
          "path": "src/lib/plan-baseline-policy.mjs",
          "sha256": "e9217a41a87057f437439420d56f3b7a0f973ae37c250c07b335634fef308560"
        },
        {
          "path": "src/lib/plan-budget-source.mjs",
          "sha256": "7ebeabf62d8fb89c6ab941b8130d196ca2e008959a9599f2db0c71d75dd3382a"
        },
        {
          "path": "src/lib/plan-import-analyzer.mjs",
          "sha256": "a132a09a7f69f218a244a46f55b9da9d873bae33c753f9d73c8c15a7daaeb9c0"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/plan-import-monthly-curve.mjs",
          "sha256": "6ce785f9c24c47f0e291b0bac40bd96a691fae68a309e4cb7a1917db31f9e6b6"
        },
        {
          "path": "src/lib/plan-import-ooxml.mjs",
          "sha256": "662abaa7523d74961c6873a8b0beb3eb7e3d3b52988fad9cc55e76c0e540a3bd"
        },
        {
          "path": "src/lib/plan-import-policy.mjs",
          "sha256": "1946b2793d0db11519d154acdb5bf0f7e8be5dc26ecd1971b846eed284d7d50f"
        },
        {
          "path": "src/lib/plan-import-store.mjs",
          "sha256": "da047723f790c0f5e7eeff855782e4db7463670d1875caf0bab1c6cce9b1a920"
        },
        {
          "path": "src/lib/plan-measurement-policy.mjs",
          "sha256": "3d6b0bce58a7f89612878310f534d8cf02f6a222c778cd4294b415c1f61157b7"
        },
        {
          "path": "src/lib/plan-measurement-source.mjs",
          "sha256": "ecf33b67a333d8ce73bfb51610218a1658cd94a26b62eb35d2290b795f826f36"
        },
        {
          "path": "src/lib/private-biometric-analyzer.mjs",
          "sha256": "36f96c5d9d4c25ee8723187a310a76682b07a888f6332712c48ab99ff5e2abd8"
        },
        {
          "path": "src/lib/private-image-upload.mjs",
          "sha256": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60"
        },
        {
          "path": "src/lib/procurement-quantity.js",
          "sha256": "53439844051cc1dbd679220d695e60e54bc1629b2f1ddb33fc125981da9326b3"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/site-register-policy.mjs",
          "sha256": "d529c4f2225e0ec851ef7df60f8c5b182a88b384958ebfd15b194683d1590434"
        },
        {
          "path": "src/lib/site-register-store.mjs",
          "sha256": "6b744c86f47dbb6dc081132675888615d76421701f96151b00646b5e1d2529c6"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/video-audio-extractor.mjs",
          "sha256": "0c85dfd39c10fdb782eca4fe57dc665c29bd7211ab7aba0dda3f8945abcb1988"
        },
        {
          "path": "src/lib/video-frame-extractor.mjs",
          "sha256": "33425a184cf097884982c43a90e3b515726027adbeb51c2cdbfc794e79dee6e6"
        },
        {
          "path": "src/lib/voice-consumption-draft.mjs",
          "sha256": "b9af424825674ca6f24a729e9ba89bae6e67adf433de10837a05e58900584c82"
        },
        {
          "path": "src/lib/voice-progress-draft.mjs",
          "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
        },
        {
          "path": "src/lib/whatsapp/field-worker-intent-policy.js",
          "sha256": "0fdf205af1c2185a16f99c4f1aaba6c36d95722ea914915a0eefe6a10d443ef9"
        },
        {
          "path": "src/lib/whatsapp/obra-intent-policy.js",
          "sha256": "cd01054ba81be6552f58dc91758e08166ea099482f28355cae570d15f3ccf8da"
        },
        {
          "path": "src/lib/whatsapp/operational-proposal-decision-policy.js",
          "sha256": "996ed641c090267679ce0fc3cb7a23f39b31ce88e761135feb0dd0c852eb74fc"
        },
        {
          "path": "src/lib/whatsapp/project-workspace-profile.js",
          "sha256": "e13473baa4ca5b4dc9851bb202f400ba174ccbfce2589be65ce8458aafa998f4"
        },
        {
          "path": "src/lib/whatsapp/template-review-policy.js",
          "sha256": "0ec4a7e544f8c2c2409d2c84ecf69fab663334dd5a5cef0ee1b1cbec82de0a08"
        },
        {
          "path": "src/lib/whatsapp/tenant-workspace-policy.js",
          "sha256": "d3416ff993fbfd70f75404166cdcd8f0b9b2e5a6741f6cde03725aab16abcd5e"
        },
        {
          "path": "src/lib/worker-channel-consent-policy.mjs",
          "sha256": "95c8393e7f2603694c5c15cfe34c9eead43007927aed0d5b633859b14c7448a9"
        },
        {
          "path": "src/lib/worker-channel-identity.mjs",
          "sha256": "1cddd58a2cd656abaca25752481fe1ca760d2bcd385a0fffbe0e685c15d59e0a"
        },
        {
          "path": "src/lib/workspace-policy.mjs",
          "sha256": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e"
        },
        {
          "path": "src/lib/workspace-runtime.mjs",
          "sha256": "bc9daa76b5eb6d66ea7a31c1efd9dbb17f39ecae53a89a684f83f18017606731"
        },
        {
          "path": "src/lib/workspace-store.mjs",
          "sha256": "5f25092121a31a06eefa59d69866db82fa3cd28afdcbd0e066e52d916478bc50"
        },
        {
          "path": "tests/fixtures/meta-kyc-outbound-baseline-b572.json",
          "sha256": "01f9954c58a6381be9f2917d1820f943da54c53542f4724570ca92267cf663e6"
        },
        {
          "path": "tests/fixtures/own-company-meta.mjs",
          "sha256": "48f9b9d63552285d3df733e0d173a19b0166d815d6b0259001876fef993092fa"
        }
      ]
    },
    {
      "family": "ORGANIZATION_USAGE",
      "previousFiles": [
        "package-lock.json",
        "package.json",
        "scripts/fixtures/canonical-participant-kyc.mjs",
        "scripts/lib/company-channel-disposable-fixture.mjs",
        "scripts/lib/disposable-postgres-cleanup.mjs",
        "scripts/verify-organization-usage-postgres.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/lib/bindx-civil-data-client.mjs",
        "src/lib/brand-assets.mjs",
        "src/lib/canonical-invited-account.mjs",
        "src/lib/company-channel-connection.mjs",
        "src/lib/company-channel-kyc.mjs",
        "src/lib/company-channel-routing.mjs",
        "src/lib/company-channel-schema.mjs",
        "src/lib/company-entitlement.mjs",
        "src/lib/company-onboarding-policy.mjs",
        "src/lib/company-phone-format.mjs",
        "src/lib/employee-intake-channel-continuity.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/legacy-access-boundary.js",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-callback-diagnostics.mjs",
        "src/lib/meta-channel-binding.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/meta-customer-app-projection.mjs",
        "src/lib/meta-customer-callback.mjs",
        "src/lib/meta-customer-coexistence.mjs",
        "src/lib/meta-customer-credentials.mjs",
        "src/lib/meta-customer-inbox-review.mjs",
        "src/lib/meta-customer-outbound.mjs",
        "src/lib/meta-customer-permissions.mjs",
        "src/lib/meta-customer-processing.mjs",
        "src/lib/meta-customer-provider.mjs",
        "src/lib/meta-customer-templates.mjs",
        "src/lib/meta-development-pilot-policy.mjs",
        "src/lib/meta-employee-intake.mjs",
        "src/lib/meta-field-bridge.mjs",
        "src/lib/meta-field-conversation.mjs",
        "src/lib/meta-kyc-challenge.mjs",
        "src/lib/meta-kyc-conversation.mjs",
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/meta-kyc-identity.mjs",
        "src/lib/meta-kyc-rejection-policy.mjs",
        "src/lib/meta-kyc-rejection.mjs",
        "src/lib/meta-own-company-policy.mjs",
        "src/lib/meta-plan-import-conversation.mjs",
        "src/lib/meta-plan-import-origin.mjs",
        "src/lib/meta-plan-import-transport.mjs",
        "src/lib/meta-test-recipient-binding.mjs",
        "src/lib/meta-whatsapp-transport.mjs",
        "src/lib/organization-resource-usage-policy.mjs",
        "src/lib/organization-resource-usage-store.mjs",
        "src/lib/organization-usage-http.mjs",
        "src/lib/organization-usage-policy.mjs",
        "src/lib/organization-usage-store.mjs",
        "src/lib/participant-account-discovery.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-bank-account.mjs",
        "src/lib/participant-bank-format.mjs",
        "src/lib/participant-bank-vault.mjs",
        "src/lib/participant-channel-kyc.mjs",
        "src/lib/participant-civil-policy.mjs",
        "src/lib/participant-civil-store.mjs",
        "src/lib/participant-kyc-chat-attempt.mjs",
        "src/lib/participant-kyc-chat-closure.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/participant-kyc-notice-links.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs",
        "src/lib/participant-onboarding-authority.mjs",
        "src/lib/participant-onboarding-current-kyc.mjs",
        "src/lib/participant-onboarding-delivery.mjs",
        "src/lib/participant-onboarding-intent.mjs",
        "src/lib/participant-onboarding-policy.mjs",
        "src/lib/participant-onboarding-reactive.mjs",
        "src/lib/participant-policy.mjs",
        "src/lib/participant-store.mjs",
        "src/lib/participant-verified-office.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/pilot-media.mjs",
        "src/lib/plan-baseline-policy.mjs",
        "src/lib/plan-import-analyzer.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/plan-import-monthly-curve.mjs",
        "src/lib/plan-import-ooxml.mjs",
        "src/lib/plan-import-policy.mjs",
        "src/lib/plan-import-store.mjs",
        "src/lib/plan-measurement-policy.mjs",
        "src/lib/plan-measurement-source.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/whatsapp/field-worker-intent-policy.js",
        "src/lib/whatsapp/obra-intent-policy.js",
        "src/lib/whatsapp/operational-proposal-decision-policy.js",
        "src/lib/whatsapp/project-workspace-profile.js",
        "src/lib/whatsapp/template-review-policy.js",
        "src/lib/whatsapp/tenant-workspace-policy.js",
        "src/lib/worker-channel-consent-policy.mjs",
        "src/lib/worker-channel-identity.mjs",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-store.mjs",
        "tests/fixtures/plan-import-ooxml-synthetic.mjs"
      ],
      "previousExternalImports": [
        "@babel/parser",
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "node:zlib",
        "pg",
        "saxes",
        "yauzl"
      ],
      "currentFiles": [
        "package-lock.json",
        "package.json",
        "scripts/fixtures/canonical-participant-kyc.mjs",
        "scripts/lib/company-channel-disposable-fixture.mjs",
        "scripts/lib/disposable-postgres-cleanup.mjs",
        "scripts/verify-organization-usage-postgres.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/lib/bindx-civil-data-client.mjs",
        "src/lib/brand-assets.mjs",
        "src/lib/canonical-invited-account.mjs",
        "src/lib/company-channel-connection.mjs",
        "src/lib/company-channel-kyc.mjs",
        "src/lib/company-channel-routing.mjs",
        "src/lib/company-channel-schema.mjs",
        "src/lib/company-entitlement.mjs",
        "src/lib/company-onboarding-policy.mjs",
        "src/lib/company-phone-format.mjs",
        "src/lib/employee-intake-channel-continuity.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/legacy-access-boundary.js",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-callback-diagnostics.mjs",
        "src/lib/meta-channel-binding.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/meta-consumption-evidence-catalog.mjs",
        "src/lib/meta-customer-app-projection.mjs",
        "src/lib/meta-customer-callback.mjs",
        "src/lib/meta-customer-coexistence.mjs",
        "src/lib/meta-customer-credentials.mjs",
        "src/lib/meta-customer-inbox-review.mjs",
        "src/lib/meta-customer-outbound.mjs",
        "src/lib/meta-customer-permissions.mjs",
        "src/lib/meta-customer-processing.mjs",
        "src/lib/meta-customer-provider.mjs",
        "src/lib/meta-customer-templates.mjs",
        "src/lib/meta-development-pilot-policy.mjs",
        "src/lib/meta-employee-intake.mjs",
        "src/lib/meta-field-bridge.mjs",
        "src/lib/meta-field-conversation.mjs",
        "src/lib/meta-kyc-challenge.mjs",
        "src/lib/meta-kyc-conversation.mjs",
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/meta-kyc-identity.mjs",
        "src/lib/meta-kyc-rejection-policy.mjs",
        "src/lib/meta-kyc-rejection.mjs",
        "src/lib/meta-own-company-policy.mjs",
        "src/lib/meta-plan-import-conversation.mjs",
        "src/lib/meta-plan-import-origin.mjs",
        "src/lib/meta-plan-import-transport.mjs",
        "src/lib/meta-test-recipient-binding.mjs",
        "src/lib/meta-whatsapp-transport.mjs",
        "src/lib/organization-resource-usage-policy.mjs",
        "src/lib/organization-resource-usage-store.mjs",
        "src/lib/organization-usage-http.mjs",
        "src/lib/organization-usage-policy.mjs",
        "src/lib/organization-usage-store.mjs",
        "src/lib/participant-account-discovery.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-bank-account.mjs",
        "src/lib/participant-bank-format.mjs",
        "src/lib/participant-bank-vault.mjs",
        "src/lib/participant-channel-kyc.mjs",
        "src/lib/participant-civil-policy.mjs",
        "src/lib/participant-civil-store.mjs",
        "src/lib/participant-kyc-chat-attempt.mjs",
        "src/lib/participant-kyc-chat-closure.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/participant-kyc-notice-links.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs",
        "src/lib/participant-onboarding-authority.mjs",
        "src/lib/participant-onboarding-current-kyc.mjs",
        "src/lib/participant-onboarding-delivery.mjs",
        "src/lib/participant-onboarding-intent.mjs",
        "src/lib/participant-onboarding-policy.mjs",
        "src/lib/participant-onboarding-reactive.mjs",
        "src/lib/participant-policy.mjs",
        "src/lib/participant-store.mjs",
        "src/lib/participant-verified-office.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/pilot-media.mjs",
        "src/lib/plan-baseline-policy.mjs",
        "src/lib/plan-budget-source.mjs",
        "src/lib/plan-import-analyzer.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/plan-import-monthly-curve.mjs",
        "src/lib/plan-import-ooxml.mjs",
        "src/lib/plan-import-policy.mjs",
        "src/lib/plan-import-store.mjs",
        "src/lib/plan-measurement-policy.mjs",
        "src/lib/plan-measurement-source.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-consumption-draft.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/whatsapp/field-worker-intent-policy.js",
        "src/lib/whatsapp/obra-intent-policy.js",
        "src/lib/whatsapp/operational-proposal-decision-policy.js",
        "src/lib/whatsapp/project-workspace-profile.js",
        "src/lib/whatsapp/template-review-policy.js",
        "src/lib/whatsapp/tenant-workspace-policy.js",
        "src/lib/worker-channel-consent-policy.mjs",
        "src/lib/worker-channel-identity.mjs",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-store.mjs",
        "tests/fixtures/plan-import-ooxml-synthetic.mjs"
      ],
      "externalImports": [
        "@babel/parser",
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "node:zlib",
        "pg",
        "saxes",
        "yauzl"
      ],
      "currentManifest": [
        {
          "path": "package-lock.json",
          "sha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449"
        },
        {
          "path": "package.json",
          "sha256": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d"
        },
        {
          "path": "scripts/fixtures/canonical-participant-kyc.mjs",
          "sha256": "09928b417f3319d76ba34fac91f89a1888f3a8e613bfde3775cac424cc441ccb"
        },
        {
          "path": "scripts/lib/company-channel-disposable-fixture.mjs",
          "sha256": "717d87a6fb1dd7f6a8b2a2d19cd3b2fee652d536e958bd833bf8431c31076138"
        },
        {
          "path": "scripts/lib/disposable-postgres-cleanup.mjs",
          "sha256": "df8d9f36b79cdd5f2d940c0dc4bbc88acbb0bec6e66c9ee5ae93ad5c6e4ab89e"
        },
        {
          "path": "scripts/verify-organization-usage-postgres.mjs",
          "sha256": "c75c023c6e8de0104b56e259545401e891d88de362bca9f444717b58c149c52b"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/lib/bindx-civil-data-client.mjs",
          "sha256": "20da64b82d14fb3d4055b9852ed8712d33b01d1bc9f50709cb55084c7d0433a2"
        },
        {
          "path": "src/lib/brand-assets.mjs",
          "sha256": "7da49f3f4d8c2f9d2cce36cc2902b5f46e044b98e67bace09e240f5b007fd4c1"
        },
        {
          "path": "src/lib/canonical-invited-account.mjs",
          "sha256": "94652997c4e6717e875041c859de9caaaeeabd9d166666d9dfbf899c51d98c7b"
        },
        {
          "path": "src/lib/company-channel-connection.mjs",
          "sha256": "f2c44860383bb49df67f7999fbe3c0a5aa57c91ebbde0cf9a3b5b367784f2c45"
        },
        {
          "path": "src/lib/company-channel-kyc.mjs",
          "sha256": "5b46276ad3aa5d656a0027be4a6bf58aa3fba4f557dd86e0c13d0d5b0cecba85"
        },
        {
          "path": "src/lib/company-channel-routing.mjs",
          "sha256": "9ed740dbb4ae1ca7d44171f176f0001d824b056a0f17a8f58ed1ea5a5a2e2f68"
        },
        {
          "path": "src/lib/company-channel-schema.mjs",
          "sha256": "96c0385fa3b6d60c8d1f92ca38dcdf32e7779f1200512806bf6d220e6be57022"
        },
        {
          "path": "src/lib/company-entitlement.mjs",
          "sha256": "65d41dfb796ef12be38b1220a99ccd3dfe277419a5e5a27e125beb29fe7e2cde"
        },
        {
          "path": "src/lib/company-onboarding-policy.mjs",
          "sha256": "cf557c7837d6264c78207028c668f8f8a2218f9632a8092cfcb8692ef11053d1"
        },
        {
          "path": "src/lib/company-phone-format.mjs",
          "sha256": "67b31114f517253961c6a774210f157867b1e2e318e6b700089eef03ef1b7209"
        },
        {
          "path": "src/lib/employee-intake-channel-continuity.mjs",
          "sha256": "59dffe3800f26cd979bd12c4cff0010ca72779e1dc62030a6f0117b6ef3fb64d"
        },
        {
          "path": "src/lib/field-hours-report.mjs",
          "sha256": "b55b767d61278bde31cb9ce4ef64faee5320fc7fe1b1bcc54559860bb4576731"
        },
        {
          "path": "src/lib/field-media-privacy.mjs",
          "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
        },
        {
          "path": "src/lib/field-media.mjs",
          "sha256": "d221ab87c4639aadb6eb8788a7203cee072f6eb1deca40605fc3d02742ab9d65"
        },
        {
          "path": "src/lib/field-operations-policy.mjs",
          "sha256": "bb33655b622a081de656f24c2e369fe7a2e05a0a0a9da7ffe455c2f39fd8fbd5"
        },
        {
          "path": "src/lib/field-operations-store.mjs",
          "sha256": "517267adb96c69bce58350b98b3a4e335ca1304a72a824e35998590e95b8987c"
        },
        {
          "path": "src/lib/field-overtime-policy.mjs",
          "sha256": "76848bd0861d6cecccb682b774599f03d3fe1322eed3cc58f5f1db5d9b1e24f8"
        },
        {
          "path": "src/lib/field-overtime-store.mjs",
          "sha256": "f29b67fff29949d5a8b14c4aed3f484ae1ce16d2ed42de486a6d5868361b1526"
        },
        {
          "path": "src/lib/field-report-feedback.mjs",
          "sha256": "70b966ae5f382abe6b5446daf1092c3f66b8f46f80ce5a0c006cffeba1cfa64c"
        },
        {
          "path": "src/lib/field-shift-summary.mjs",
          "sha256": "41f47aa7a0826ba1fe29b554c7575ec60c9861f0c18c863f06e8c3d00cb0f83c"
        },
        {
          "path": "src/lib/geo.js",
          "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
        },
        {
          "path": "src/lib/legacy-access-boundary.js",
          "sha256": "e1af7e83dac3c18bcf3b235d111d936d6dd6167925a3e1459d70a33913035370"
        },
        {
          "path": "src/lib/material-inventory.mjs",
          "sha256": "3af0b0e9c9003d09582ec4e8b21d1e35746dd3839fc7f01071935b9a4ea95333"
        },
        {
          "path": "src/lib/meta-callback-diagnostics.mjs",
          "sha256": "b16fcfbeabe02b119d0337485504490a0c8e60363e841e378ae4c7722816d3bc"
        },
        {
          "path": "src/lib/meta-channel-binding.mjs",
          "sha256": "0ba9e9de3b6dcca46524ab2df22236dbbcd5be5e6cef571df1ec47a01633672e"
        },
        {
          "path": "src/lib/meta-cloud-protocol.mjs",
          "sha256": "c6d5f1e1b4119dd2529860e3bd61a1b22d602f71ad301b2f04cec3ab4bbbed3c"
        },
        {
          "path": "src/lib/meta-consumption-evidence-catalog.mjs",
          "sha256": "cd4eb1ccf8617060aa2bb352cc9467981f7d17649be8b24233413c133c407bff"
        },
        {
          "path": "src/lib/meta-customer-app-projection.mjs",
          "sha256": "7b4b95712f143555a0e23b8ac98fc0e1d2f108e9fbefb4e861d20d9b464ef003"
        },
        {
          "path": "src/lib/meta-customer-callback.mjs",
          "sha256": "da90e3ed097c287a7c080d05daf5e4b0c0bb82544d2f7dab4cb1ee99880c3fd0"
        },
        {
          "path": "src/lib/meta-customer-coexistence.mjs",
          "sha256": "2cf704b2d3842d4ff7ae48a438c1271ad610ccf4e92a6214d97338e91e999c8e"
        },
        {
          "path": "src/lib/meta-customer-credentials.mjs",
          "sha256": "44a05a0b46417de835eb289882b0b2c6d71158f207c16c48228f1ac4b67cca0f"
        },
        {
          "path": "src/lib/meta-customer-inbox-review.mjs",
          "sha256": "250bd69c487dc8dffed5500c1ca0f9adb77843352902c41e4a63da7656bf2eaa"
        },
        {
          "path": "src/lib/meta-customer-outbound.mjs",
          "sha256": "84a249b3777d3be843b20b09d0c6cd81b6fab7415dc22f124477d87475eead09"
        },
        {
          "path": "src/lib/meta-customer-permissions.mjs",
          "sha256": "ce3671bd46af8e487c45319facbca8e6b522620fd16ee3163e5048b5ecb6585d"
        },
        {
          "path": "src/lib/meta-customer-processing.mjs",
          "sha256": "e4a52dbd2ce86793b66c4af5963c288b13d7b2b2f656c4c6f795bcac8074f4ad"
        },
        {
          "path": "src/lib/meta-customer-provider.mjs",
          "sha256": "102ae45ad7d0a1054d2c65cdbfa3a6a96accfcd982bebce8d6c32c7bf24b21a2"
        },
        {
          "path": "src/lib/meta-customer-templates.mjs",
          "sha256": "ca9e491b8b1b4c25c89585408cb53eae13e2423fdf48a93deed0846126e1c46c"
        },
        {
          "path": "src/lib/meta-development-pilot-policy.mjs",
          "sha256": "6f3a854898ea28d108341f35fe7f5f23facf3d574e586b96a2343a8038cc8c79"
        },
        {
          "path": "src/lib/meta-employee-intake.mjs",
          "sha256": "72e80601323adbe35c9ec1f61e49e3428007da55e567c724ca8dce3c42de042b"
        },
        {
          "path": "src/lib/meta-field-bridge.mjs",
          "sha256": "7f3bb80ba828e202f24e1d768b855131642dcc89fde39fcac4b81d64aa632955"
        },
        {
          "path": "src/lib/meta-field-conversation.mjs",
          "sha256": "c68887db8fa04f5806d1c0f4c29e829befb89931b8371041ad65334deb1dab4d"
        },
        {
          "path": "src/lib/meta-kyc-challenge.mjs",
          "sha256": "f5a03ec770e6d85de095393bf38c331c0803a7fe3c7f1b72a2addd9cac7484eb"
        },
        {
          "path": "src/lib/meta-kyc-conversation.mjs",
          "sha256": "17d1e52e826dcaa899e2e6b846e2856c73f73b18b7abfe30e951de0de8623ef6"
        },
        {
          "path": "src/lib/meta-kyc-current-image.mjs",
          "sha256": "03ef3966025f520b373e937a6230f846185f3b4845830da5a38c0d8f02e155c2"
        },
        {
          "path": "src/lib/meta-kyc-identity.mjs",
          "sha256": "295f87ecb3b4586313a4f9c48a2d5c9acf8fa263682d99d44a966be243af2319"
        },
        {
          "path": "src/lib/meta-kyc-rejection-policy.mjs",
          "sha256": "e6c96aba8077d75e152f45dc49fe32d41e103658d4bff4281c8c8a98e3fff0c1"
        },
        {
          "path": "src/lib/meta-kyc-rejection.mjs",
          "sha256": "5477adafd994a54c9e7bbcc196b6af4fbe0b9cc03ab563775b8258290e31f3d0"
        },
        {
          "path": "src/lib/meta-own-company-policy.mjs",
          "sha256": "7db3875cd0f31fec077f4d9a4f8875be1ddf4a5772acff4559069ae950ff0821"
        },
        {
          "path": "src/lib/meta-plan-import-conversation.mjs",
          "sha256": "6f3c261cb2cde943e0202ab5097d664958f5702975cdf5914aeac35e5a1bac1c"
        },
        {
          "path": "src/lib/meta-plan-import-origin.mjs",
          "sha256": "cdb619d1709a982323c9892383def1428db2ade771babdb18e4032b3535d953e"
        },
        {
          "path": "src/lib/meta-plan-import-transport.mjs",
          "sha256": "e42f48f0175dd697bac3de61d7d9893d35c2b1696c1ae276a4698eb3c36a4634"
        },
        {
          "path": "src/lib/meta-test-recipient-binding.mjs",
          "sha256": "2aea6f5815bd2d90fe891b45a79b48d339a3eebc681ac40b3347244e546c4b66"
        },
        {
          "path": "src/lib/meta-whatsapp-transport.mjs",
          "sha256": "f99569c7f587e9be1268aa254d2368226346a7ebf7e48fa6ca63a0064cf41310"
        },
        {
          "path": "src/lib/organization-resource-usage-policy.mjs",
          "sha256": "089ac1ee2ca6afd30aab1d0abd38274698ca56991d1c5225ea8e44c8b9fdc449"
        },
        {
          "path": "src/lib/organization-resource-usage-store.mjs",
          "sha256": "869502cd3b11d1625c4dbb843ebc53d92e43dd21d13fcb53f22538684ec4f2ef"
        },
        {
          "path": "src/lib/organization-usage-http.mjs",
          "sha256": "3c6ac61cd20a9743926e159aaf2662f1963ec56d8ca89c86f3a3ffdbd5bf2f20"
        },
        {
          "path": "src/lib/organization-usage-policy.mjs",
          "sha256": "94997530d6c1fd420f0233172b07f8ba7dd7546a2ac9af75eaa30736400237ae"
        },
        {
          "path": "src/lib/organization-usage-store.mjs",
          "sha256": "9497c32b76ffda1d5456267d4fcdc90b674618df1d60bd84dbbd7bc3b2827347"
        },
        {
          "path": "src/lib/participant-account-discovery.mjs",
          "sha256": "11b37ca397fdb195aac7addc1c16842fb28a9c83a73a82a57bf2791ed3038738"
        },
        {
          "path": "src/lib/participant-admission.mjs",
          "sha256": "2cbb466e49d742cd23da1bb85a4e89b7e411dc724c8d1f2eb66b39717f283dd9"
        },
        {
          "path": "src/lib/participant-analysis-consent.mjs",
          "sha256": "7f7d371914d1e46ac799cd1683afdc0418186c15a20156e697ecd879c81bf8c1"
        },
        {
          "path": "src/lib/participant-approved-identity.mjs",
          "sha256": "834d81e70cedbd967ff84d880ea9d697c2168d2220fb23d9eb14c1aba1cdbbf1"
        },
        {
          "path": "src/lib/participant-bank-account.mjs",
          "sha256": "29980527a6eda3bbc0125098a4b616082034a71fb1afb772ff87f476bc0ce981"
        },
        {
          "path": "src/lib/participant-bank-format.mjs",
          "sha256": "ebbb206a14eaac57230b53ec1afae99c4be60c8739baf0d1d047d4a47ba464db"
        },
        {
          "path": "src/lib/participant-bank-vault.mjs",
          "sha256": "06e990ab79c896628756f3c74a50dcc7e8062f4fa296f56a31e4150b5badc16a"
        },
        {
          "path": "src/lib/participant-channel-kyc.mjs",
          "sha256": "2ac9414429238162a9b16d4adea421df0bff9fb93ea4fbf2f9d6677f2659fb2d"
        },
        {
          "path": "src/lib/participant-civil-policy.mjs",
          "sha256": "e180a64c788d6cd20e766cb4fd32dbba1c7cb3954c01405ac8675ec023eef278"
        },
        {
          "path": "src/lib/participant-civil-store.mjs",
          "sha256": "5f440c0c76ca67b87a7e5d4e90e7a48f18ea3603b16434b35beeddd3bdf168a4"
        },
        {
          "path": "src/lib/participant-kyc-chat-attempt.mjs",
          "sha256": "d3f0a65f866fa027ee008963fcb6ffcad0cd33de94cace7603cf40bc78c21aeb"
        },
        {
          "path": "src/lib/participant-kyc-chat-closure.mjs",
          "sha256": "4a6a368910de95582c2baabc70bab7f4b4afa4413e8ebdb75a1e8b867c098a19"
        },
        {
          "path": "src/lib/participant-kyc-chat-copy.mjs",
          "sha256": "d886219584d5e8b9d9db1ad16a36c726f6982fa0e8400c3be51af2623574ab96"
        },
        {
          "path": "src/lib/participant-kyc-image-set.mjs",
          "sha256": "190ce2560286a58d42668da7b912aeabcfa76ee14086503bf1609304e5f0e8fb"
        },
        {
          "path": "src/lib/participant-kyc-notice-links.mjs",
          "sha256": "3547f3fc2ebdefc2522971467d4c77498160dde7806a25bf9fa18c527c8658fc"
        },
        {
          "path": "src/lib/participant-kyc-preanalysis-policy.mjs",
          "sha256": "8c5286a0a5d41364e92e60f2ce2ba96caccc8667960f966b5caead37acafab49"
        },
        {
          "path": "src/lib/participant-onboarding-authority.mjs",
          "sha256": "dad5d9fd0a61c493ff02331d5333982627cdeb3a7addb74a3c86d44da931f916"
        },
        {
          "path": "src/lib/participant-onboarding-current-kyc.mjs",
          "sha256": "232fecca4f6cf775e5151ec460560e0c1abd6646dc3c532140cabe26dfb42119"
        },
        {
          "path": "src/lib/participant-onboarding-delivery.mjs",
          "sha256": "615592cc1a6215e24c48e8873a27211421853f99ca9093e6f490f77532b3d013"
        },
        {
          "path": "src/lib/participant-onboarding-intent.mjs",
          "sha256": "07114f6066e10617357c4e5d8e2db2b9dc846e5f4cffbc5aef09f2b7bfada9de"
        },
        {
          "path": "src/lib/participant-onboarding-policy.mjs",
          "sha256": "59409797ce3e13b7cfe63fe21d8d7e2c848ee49e0766015939242a9f43687c03"
        },
        {
          "path": "src/lib/participant-onboarding-reactive.mjs",
          "sha256": "666a8c27f3ab7d6fdbe66c91f22ace4e25b04b98e865f401d19c72212916104d"
        },
        {
          "path": "src/lib/participant-policy.mjs",
          "sha256": "7f3969ab1ebac5f01696149d76337199eb64c2fd09015c44c07e8b7e7088d62f"
        },
        {
          "path": "src/lib/participant-store.mjs",
          "sha256": "2296495e366b9ea0c2511066584e93ddf1cff51b5eefd05c6121d2143d78f5c9"
        },
        {
          "path": "src/lib/participant-verified-office.mjs",
          "sha256": "4922f392490aa6d49b8a8a45a56ac0b03831a8ad2efe89ce1e3adfd77d603d89"
        },
        {
          "path": "src/lib/person-worksite-journey.mjs",
          "sha256": "d3174df793150125c0b6a5d9f37d56336e72cab1efb43a361065b78ac54c210a"
        },
        {
          "path": "src/lib/pilot-media.mjs",
          "sha256": "55e35757cea03c312df68cebad100ee8b7d904b418eca9082359ea34e68f8fa9"
        },
        {
          "path": "src/lib/plan-baseline-policy.mjs",
          "sha256": "e9217a41a87057f437439420d56f3b7a0f973ae37c250c07b335634fef308560"
        },
        {
          "path": "src/lib/plan-budget-source.mjs",
          "sha256": "7ebeabf62d8fb89c6ab941b8130d196ca2e008959a9599f2db0c71d75dd3382a"
        },
        {
          "path": "src/lib/plan-import-analyzer.mjs",
          "sha256": "a132a09a7f69f218a244a46f55b9da9d873bae33c753f9d73c8c15a7daaeb9c0"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/plan-import-monthly-curve.mjs",
          "sha256": "6ce785f9c24c47f0e291b0bac40bd96a691fae68a309e4cb7a1917db31f9e6b6"
        },
        {
          "path": "src/lib/plan-import-ooxml.mjs",
          "sha256": "662abaa7523d74961c6873a8b0beb3eb7e3d3b52988fad9cc55e76c0e540a3bd"
        },
        {
          "path": "src/lib/plan-import-policy.mjs",
          "sha256": "1946b2793d0db11519d154acdb5bf0f7e8be5dc26ecd1971b846eed284d7d50f"
        },
        {
          "path": "src/lib/plan-import-store.mjs",
          "sha256": "da047723f790c0f5e7eeff855782e4db7463670d1875caf0bab1c6cce9b1a920"
        },
        {
          "path": "src/lib/plan-measurement-policy.mjs",
          "sha256": "3d6b0bce58a7f89612878310f534d8cf02f6a222c778cd4294b415c1f61157b7"
        },
        {
          "path": "src/lib/plan-measurement-source.mjs",
          "sha256": "ecf33b67a333d8ce73bfb51610218a1658cd94a26b62eb35d2290b795f826f36"
        },
        {
          "path": "src/lib/private-image-upload.mjs",
          "sha256": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60"
        },
        {
          "path": "src/lib/procurement-quantity.js",
          "sha256": "53439844051cc1dbd679220d695e60e54bc1629b2f1ddb33fc125981da9326b3"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/site-register-policy.mjs",
          "sha256": "d529c4f2225e0ec851ef7df60f8c5b182a88b384958ebfd15b194683d1590434"
        },
        {
          "path": "src/lib/site-register-store.mjs",
          "sha256": "6b744c86f47dbb6dc081132675888615d76421701f96151b00646b5e1d2529c6"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/video-audio-extractor.mjs",
          "sha256": "0c85dfd39c10fdb782eca4fe57dc665c29bd7211ab7aba0dda3f8945abcb1988"
        },
        {
          "path": "src/lib/video-frame-extractor.mjs",
          "sha256": "33425a184cf097884982c43a90e3b515726027adbeb51c2cdbfc794e79dee6e6"
        },
        {
          "path": "src/lib/voice-consumption-draft.mjs",
          "sha256": "b9af424825674ca6f24a729e9ba89bae6e67adf433de10837a05e58900584c82"
        },
        {
          "path": "src/lib/voice-progress-draft.mjs",
          "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
        },
        {
          "path": "src/lib/whatsapp/field-worker-intent-policy.js",
          "sha256": "0fdf205af1c2185a16f99c4f1aaba6c36d95722ea914915a0eefe6a10d443ef9"
        },
        {
          "path": "src/lib/whatsapp/obra-intent-policy.js",
          "sha256": "cd01054ba81be6552f58dc91758e08166ea099482f28355cae570d15f3ccf8da"
        },
        {
          "path": "src/lib/whatsapp/operational-proposal-decision-policy.js",
          "sha256": "996ed641c090267679ce0fc3cb7a23f39b31ce88e761135feb0dd0c852eb74fc"
        },
        {
          "path": "src/lib/whatsapp/project-workspace-profile.js",
          "sha256": "e13473baa4ca5b4dc9851bb202f400ba174ccbfce2589be65ce8458aafa998f4"
        },
        {
          "path": "src/lib/whatsapp/template-review-policy.js",
          "sha256": "0ec4a7e544f8c2c2409d2c84ecf69fab663334dd5a5cef0ee1b1cbec82de0a08"
        },
        {
          "path": "src/lib/whatsapp/tenant-workspace-policy.js",
          "sha256": "d3416ff993fbfd70f75404166cdcd8f0b9b2e5a6741f6cde03725aab16abcd5e"
        },
        {
          "path": "src/lib/worker-channel-consent-policy.mjs",
          "sha256": "95c8393e7f2603694c5c15cfe34c9eead43007927aed0d5b633859b14c7448a9"
        },
        {
          "path": "src/lib/worker-channel-identity.mjs",
          "sha256": "1cddd58a2cd656abaca25752481fe1ca760d2bcd385a0fffbe0e685c15d59e0a"
        },
        {
          "path": "src/lib/workspace-policy.mjs",
          "sha256": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e"
        },
        {
          "path": "src/lib/workspace-store.mjs",
          "sha256": "5f25092121a31a06eefa59d69866db82fa3cd28afdcbd0e066e52d916478bc50"
        },
        {
          "path": "tests/fixtures/plan-import-ooxml-synthetic.mjs",
          "sha256": "4157135abf5798807025a18abd121c7fdbc7be2a5e0099084bbb02ea28f20931"
        }
      ]
    },
    {
      "family": "KYC_REPLY_FEEDBACK",
      "previousFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/company-channel-disposable-fixture.mjs",
        "scripts/lib/disposable-postgres-cleanup.mjs",
        "scripts/verify-company-kyc-rejection-feedback-postgres.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/lib/bindx-civil-data-client.mjs",
        "src/lib/brand-assets.mjs",
        "src/lib/canonical-invited-account.mjs",
        "src/lib/company-channel-connection.mjs",
        "src/lib/company-channel-kyc.mjs",
        "src/lib/company-channel-routing.mjs",
        "src/lib/company-channel-schema.mjs",
        "src/lib/company-entitlement.mjs",
        "src/lib/company-onboarding-policy.mjs",
        "src/lib/company-phone-format.mjs",
        "src/lib/employee-intake-channel-continuity.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/legacy-access-boundary.js",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-callback-diagnostics.mjs",
        "src/lib/meta-channel-binding.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/meta-customer-app-projection.mjs",
        "src/lib/meta-customer-callback.mjs",
        "src/lib/meta-customer-coexistence.mjs",
        "src/lib/meta-customer-credentials.mjs",
        "src/lib/meta-customer-inbox-review.mjs",
        "src/lib/meta-customer-outbound.mjs",
        "src/lib/meta-customer-permissions.mjs",
        "src/lib/meta-customer-processing.mjs",
        "src/lib/meta-customer-provider.mjs",
        "src/lib/meta-customer-templates.mjs",
        "src/lib/meta-development-pilot-policy.mjs",
        "src/lib/meta-employee-intake.mjs",
        "src/lib/meta-field-bridge.mjs",
        "src/lib/meta-field-conversation.mjs",
        "src/lib/meta-kyc-bridge.mjs",
        "src/lib/meta-kyc-challenge.mjs",
        "src/lib/meta-kyc-conversation.mjs",
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/meta-kyc-identity.mjs",
        "src/lib/meta-kyc-outbound.mjs",
        "src/lib/meta-kyc-rejection-policy.mjs",
        "src/lib/meta-kyc-rejection.mjs",
        "src/lib/meta-own-company-policy.mjs",
        "src/lib/meta-plan-import-conversation.mjs",
        "src/lib/meta-plan-import-origin.mjs",
        "src/lib/meta-plan-import-transport.mjs",
        "src/lib/meta-test-recipient-binding.mjs",
        "src/lib/meta-whatsapp-transport.mjs",
        "src/lib/organization-resource-usage-policy.mjs",
        "src/lib/organization-usage-policy.mjs",
        "src/lib/participant-account-discovery.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-bank-account.mjs",
        "src/lib/participant-bank-format.mjs",
        "src/lib/participant-bank-vault.mjs",
        "src/lib/participant-channel-kyc.mjs",
        "src/lib/participant-civil-policy.mjs",
        "src/lib/participant-civil-store.mjs",
        "src/lib/participant-kyc-chat-attempt.mjs",
        "src/lib/participant-kyc-chat-closure.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/participant-kyc-notice-links.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs",
        "src/lib/participant-onboarding-authority.mjs",
        "src/lib/participant-onboarding-current-kyc.mjs",
        "src/lib/participant-onboarding-delivery.mjs",
        "src/lib/participant-onboarding-intent.mjs",
        "src/lib/participant-onboarding-policy.mjs",
        "src/lib/participant-onboarding-reactive.mjs",
        "src/lib/participant-policy.mjs",
        "src/lib/participant-store.mjs",
        "src/lib/participant-verified-office.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/pilot-media.mjs",
        "src/lib/plan-baseline-policy.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/plan-import-monthly-curve.mjs",
        "src/lib/plan-import-ooxml.mjs",
        "src/lib/plan-import-policy.mjs",
        "src/lib/plan-import-store.mjs",
        "src/lib/plan-measurement-policy.mjs",
        "src/lib/plan-measurement-source.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/whatsapp/field-worker-intent-policy.js",
        "src/lib/whatsapp/obra-intent-policy.js",
        "src/lib/whatsapp/operational-proposal-decision-policy.js",
        "src/lib/whatsapp/project-workspace-profile.js",
        "src/lib/whatsapp/template-review-policy.js",
        "src/lib/whatsapp/tenant-workspace-policy.js",
        "src/lib/worker-channel-consent-policy.mjs",
        "src/lib/worker-channel-identity.mjs",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-store.mjs"
      ],
      "previousExternalImports": [
        "@babel/parser",
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "node:zlib",
        "pg",
        "saxes",
        "yauzl"
      ],
      "currentFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/company-channel-disposable-fixture.mjs",
        "scripts/lib/disposable-postgres-cleanup.mjs",
        "scripts/verify-company-kyc-rejection-feedback-postgres.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/lib/bindx-civil-data-client.mjs",
        "src/lib/brand-assets.mjs",
        "src/lib/canonical-invited-account.mjs",
        "src/lib/company-channel-connection.mjs",
        "src/lib/company-channel-kyc.mjs",
        "src/lib/company-channel-routing.mjs",
        "src/lib/company-channel-schema.mjs",
        "src/lib/company-entitlement.mjs",
        "src/lib/company-onboarding-policy.mjs",
        "src/lib/company-phone-format.mjs",
        "src/lib/employee-intake-channel-continuity.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/legacy-access-boundary.js",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-callback-diagnostics.mjs",
        "src/lib/meta-channel-binding.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/meta-consumption-evidence-catalog.mjs",
        "src/lib/meta-customer-app-projection.mjs",
        "src/lib/meta-customer-callback.mjs",
        "src/lib/meta-customer-coexistence.mjs",
        "src/lib/meta-customer-credentials.mjs",
        "src/lib/meta-customer-inbox-review.mjs",
        "src/lib/meta-customer-outbound.mjs",
        "src/lib/meta-customer-permissions.mjs",
        "src/lib/meta-customer-processing.mjs",
        "src/lib/meta-customer-provider.mjs",
        "src/lib/meta-customer-templates.mjs",
        "src/lib/meta-development-pilot-policy.mjs",
        "src/lib/meta-employee-intake.mjs",
        "src/lib/meta-field-bridge.mjs",
        "src/lib/meta-field-conversation.mjs",
        "src/lib/meta-kyc-bridge.mjs",
        "src/lib/meta-kyc-challenge.mjs",
        "src/lib/meta-kyc-conversation.mjs",
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/meta-kyc-identity.mjs",
        "src/lib/meta-kyc-outbound.mjs",
        "src/lib/meta-kyc-rejection-policy.mjs",
        "src/lib/meta-kyc-rejection.mjs",
        "src/lib/meta-own-company-policy.mjs",
        "src/lib/meta-plan-import-conversation.mjs",
        "src/lib/meta-plan-import-origin.mjs",
        "src/lib/meta-plan-import-transport.mjs",
        "src/lib/meta-test-recipient-binding.mjs",
        "src/lib/meta-whatsapp-transport.mjs",
        "src/lib/organization-resource-usage-policy.mjs",
        "src/lib/organization-usage-policy.mjs",
        "src/lib/participant-account-discovery.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-bank-account.mjs",
        "src/lib/participant-bank-format.mjs",
        "src/lib/participant-bank-vault.mjs",
        "src/lib/participant-channel-kyc.mjs",
        "src/lib/participant-civil-policy.mjs",
        "src/lib/participant-civil-store.mjs",
        "src/lib/participant-kyc-chat-attempt.mjs",
        "src/lib/participant-kyc-chat-closure.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/participant-kyc-notice-links.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs",
        "src/lib/participant-onboarding-authority.mjs",
        "src/lib/participant-onboarding-current-kyc.mjs",
        "src/lib/participant-onboarding-delivery.mjs",
        "src/lib/participant-onboarding-intent.mjs",
        "src/lib/participant-onboarding-policy.mjs",
        "src/lib/participant-onboarding-reactive.mjs",
        "src/lib/participant-policy.mjs",
        "src/lib/participant-store.mjs",
        "src/lib/participant-verified-office.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/pilot-media.mjs",
        "src/lib/plan-baseline-policy.mjs",
        "src/lib/plan-budget-source.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/plan-import-monthly-curve.mjs",
        "src/lib/plan-import-ooxml.mjs",
        "src/lib/plan-import-policy.mjs",
        "src/lib/plan-import-store.mjs",
        "src/lib/plan-measurement-policy.mjs",
        "src/lib/plan-measurement-source.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-consumption-draft.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/whatsapp/field-worker-intent-policy.js",
        "src/lib/whatsapp/obra-intent-policy.js",
        "src/lib/whatsapp/operational-proposal-decision-policy.js",
        "src/lib/whatsapp/project-workspace-profile.js",
        "src/lib/whatsapp/template-review-policy.js",
        "src/lib/whatsapp/tenant-workspace-policy.js",
        "src/lib/worker-channel-consent-policy.mjs",
        "src/lib/worker-channel-identity.mjs",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-store.mjs"
      ],
      "externalImports": [
        "@babel/parser",
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "node:zlib",
        "pg",
        "saxes",
        "yauzl"
      ],
      "currentManifest": [
        {
          "path": "package-lock.json",
          "sha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449"
        },
        {
          "path": "package.json",
          "sha256": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d"
        },
        {
          "path": "scripts/lib/company-channel-disposable-fixture.mjs",
          "sha256": "717d87a6fb1dd7f6a8b2a2d19cd3b2fee652d536e958bd833bf8431c31076138"
        },
        {
          "path": "scripts/lib/disposable-postgres-cleanup.mjs",
          "sha256": "df8d9f36b79cdd5f2d940c0dc4bbc88acbb0bec6e66c9ee5ae93ad5c6e4ab89e"
        },
        {
          "path": "scripts/verify-company-kyc-rejection-feedback-postgres.mjs",
          "sha256": "a64cd0fa267dda98f9c9430327ab39f2cfec304fadc7fddb6c804ba41091ba32"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/lib/bindx-civil-data-client.mjs",
          "sha256": "20da64b82d14fb3d4055b9852ed8712d33b01d1bc9f50709cb55084c7d0433a2"
        },
        {
          "path": "src/lib/brand-assets.mjs",
          "sha256": "7da49f3f4d8c2f9d2cce36cc2902b5f46e044b98e67bace09e240f5b007fd4c1"
        },
        {
          "path": "src/lib/canonical-invited-account.mjs",
          "sha256": "94652997c4e6717e875041c859de9caaaeeabd9d166666d9dfbf899c51d98c7b"
        },
        {
          "path": "src/lib/company-channel-connection.mjs",
          "sha256": "f2c44860383bb49df67f7999fbe3c0a5aa57c91ebbde0cf9a3b5b367784f2c45"
        },
        {
          "path": "src/lib/company-channel-kyc.mjs",
          "sha256": "5b46276ad3aa5d656a0027be4a6bf58aa3fba4f557dd86e0c13d0d5b0cecba85"
        },
        {
          "path": "src/lib/company-channel-routing.mjs",
          "sha256": "9ed740dbb4ae1ca7d44171f176f0001d824b056a0f17a8f58ed1ea5a5a2e2f68"
        },
        {
          "path": "src/lib/company-channel-schema.mjs",
          "sha256": "96c0385fa3b6d60c8d1f92ca38dcdf32e7779f1200512806bf6d220e6be57022"
        },
        {
          "path": "src/lib/company-entitlement.mjs",
          "sha256": "65d41dfb796ef12be38b1220a99ccd3dfe277419a5e5a27e125beb29fe7e2cde"
        },
        {
          "path": "src/lib/company-onboarding-policy.mjs",
          "sha256": "cf557c7837d6264c78207028c668f8f8a2218f9632a8092cfcb8692ef11053d1"
        },
        {
          "path": "src/lib/company-phone-format.mjs",
          "sha256": "67b31114f517253961c6a774210f157867b1e2e318e6b700089eef03ef1b7209"
        },
        {
          "path": "src/lib/employee-intake-channel-continuity.mjs",
          "sha256": "59dffe3800f26cd979bd12c4cff0010ca72779e1dc62030a6f0117b6ef3fb64d"
        },
        {
          "path": "src/lib/field-hours-report.mjs",
          "sha256": "b55b767d61278bde31cb9ce4ef64faee5320fc7fe1b1bcc54559860bb4576731"
        },
        {
          "path": "src/lib/field-media-privacy.mjs",
          "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
        },
        {
          "path": "src/lib/field-media.mjs",
          "sha256": "d221ab87c4639aadb6eb8788a7203cee072f6eb1deca40605fc3d02742ab9d65"
        },
        {
          "path": "src/lib/field-operations-policy.mjs",
          "sha256": "bb33655b622a081de656f24c2e369fe7a2e05a0a0a9da7ffe455c2f39fd8fbd5"
        },
        {
          "path": "src/lib/field-operations-store.mjs",
          "sha256": "517267adb96c69bce58350b98b3a4e335ca1304a72a824e35998590e95b8987c"
        },
        {
          "path": "src/lib/field-overtime-policy.mjs",
          "sha256": "76848bd0861d6cecccb682b774599f03d3fe1322eed3cc58f5f1db5d9b1e24f8"
        },
        {
          "path": "src/lib/field-overtime-store.mjs",
          "sha256": "f29b67fff29949d5a8b14c4aed3f484ae1ce16d2ed42de486a6d5868361b1526"
        },
        {
          "path": "src/lib/field-report-feedback.mjs",
          "sha256": "70b966ae5f382abe6b5446daf1092c3f66b8f46f80ce5a0c006cffeba1cfa64c"
        },
        {
          "path": "src/lib/field-shift-summary.mjs",
          "sha256": "41f47aa7a0826ba1fe29b554c7575ec60c9861f0c18c863f06e8c3d00cb0f83c"
        },
        {
          "path": "src/lib/geo.js",
          "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
        },
        {
          "path": "src/lib/legacy-access-boundary.js",
          "sha256": "e1af7e83dac3c18bcf3b235d111d936d6dd6167925a3e1459d70a33913035370"
        },
        {
          "path": "src/lib/material-inventory.mjs",
          "sha256": "3af0b0e9c9003d09582ec4e8b21d1e35746dd3839fc7f01071935b9a4ea95333"
        },
        {
          "path": "src/lib/meta-callback-diagnostics.mjs",
          "sha256": "b16fcfbeabe02b119d0337485504490a0c8e60363e841e378ae4c7722816d3bc"
        },
        {
          "path": "src/lib/meta-channel-binding.mjs",
          "sha256": "0ba9e9de3b6dcca46524ab2df22236dbbcd5be5e6cef571df1ec47a01633672e"
        },
        {
          "path": "src/lib/meta-cloud-protocol.mjs",
          "sha256": "c6d5f1e1b4119dd2529860e3bd61a1b22d602f71ad301b2f04cec3ab4bbbed3c"
        },
        {
          "path": "src/lib/meta-consumption-evidence-catalog.mjs",
          "sha256": "cd4eb1ccf8617060aa2bb352cc9467981f7d17649be8b24233413c133c407bff"
        },
        {
          "path": "src/lib/meta-customer-app-projection.mjs",
          "sha256": "7b4b95712f143555a0e23b8ac98fc0e1d2f108e9fbefb4e861d20d9b464ef003"
        },
        {
          "path": "src/lib/meta-customer-callback.mjs",
          "sha256": "da90e3ed097c287a7c080d05daf5e4b0c0bb82544d2f7dab4cb1ee99880c3fd0"
        },
        {
          "path": "src/lib/meta-customer-coexistence.mjs",
          "sha256": "2cf704b2d3842d4ff7ae48a438c1271ad610ccf4e92a6214d97338e91e999c8e"
        },
        {
          "path": "src/lib/meta-customer-credentials.mjs",
          "sha256": "44a05a0b46417de835eb289882b0b2c6d71158f207c16c48228f1ac4b67cca0f"
        },
        {
          "path": "src/lib/meta-customer-inbox-review.mjs",
          "sha256": "250bd69c487dc8dffed5500c1ca0f9adb77843352902c41e4a63da7656bf2eaa"
        },
        {
          "path": "src/lib/meta-customer-outbound.mjs",
          "sha256": "84a249b3777d3be843b20b09d0c6cd81b6fab7415dc22f124477d87475eead09"
        },
        {
          "path": "src/lib/meta-customer-permissions.mjs",
          "sha256": "ce3671bd46af8e487c45319facbca8e6b522620fd16ee3163e5048b5ecb6585d"
        },
        {
          "path": "src/lib/meta-customer-processing.mjs",
          "sha256": "e4a52dbd2ce86793b66c4af5963c288b13d7b2b2f656c4c6f795bcac8074f4ad"
        },
        {
          "path": "src/lib/meta-customer-provider.mjs",
          "sha256": "102ae45ad7d0a1054d2c65cdbfa3a6a96accfcd982bebce8d6c32c7bf24b21a2"
        },
        {
          "path": "src/lib/meta-customer-templates.mjs",
          "sha256": "ca9e491b8b1b4c25c89585408cb53eae13e2423fdf48a93deed0846126e1c46c"
        },
        {
          "path": "src/lib/meta-development-pilot-policy.mjs",
          "sha256": "6f3a854898ea28d108341f35fe7f5f23facf3d574e586b96a2343a8038cc8c79"
        },
        {
          "path": "src/lib/meta-employee-intake.mjs",
          "sha256": "72e80601323adbe35c9ec1f61e49e3428007da55e567c724ca8dce3c42de042b"
        },
        {
          "path": "src/lib/meta-field-bridge.mjs",
          "sha256": "7f3bb80ba828e202f24e1d768b855131642dcc89fde39fcac4b81d64aa632955"
        },
        {
          "path": "src/lib/meta-field-conversation.mjs",
          "sha256": "c68887db8fa04f5806d1c0f4c29e829befb89931b8371041ad65334deb1dab4d"
        },
        {
          "path": "src/lib/meta-kyc-bridge.mjs",
          "sha256": "33368028c42baf9f720390de4fc03cbed1448368079415850a41f3adadfebed3"
        },
        {
          "path": "src/lib/meta-kyc-challenge.mjs",
          "sha256": "f5a03ec770e6d85de095393bf38c331c0803a7fe3c7f1b72a2addd9cac7484eb"
        },
        {
          "path": "src/lib/meta-kyc-conversation.mjs",
          "sha256": "17d1e52e826dcaa899e2e6b846e2856c73f73b18b7abfe30e951de0de8623ef6"
        },
        {
          "path": "src/lib/meta-kyc-current-image.mjs",
          "sha256": "03ef3966025f520b373e937a6230f846185f3b4845830da5a38c0d8f02e155c2"
        },
        {
          "path": "src/lib/meta-kyc-identity.mjs",
          "sha256": "295f87ecb3b4586313a4f9c48a2d5c9acf8fa263682d99d44a966be243af2319"
        },
        {
          "path": "src/lib/meta-kyc-outbound.mjs",
          "sha256": "e0766080e345b3777fc87a6f8014a34073beb48a3c9205aa4c1cb49251b4e589"
        },
        {
          "path": "src/lib/meta-kyc-rejection-policy.mjs",
          "sha256": "e6c96aba8077d75e152f45dc49fe32d41e103658d4bff4281c8c8a98e3fff0c1"
        },
        {
          "path": "src/lib/meta-kyc-rejection.mjs",
          "sha256": "5477adafd994a54c9e7bbcc196b6af4fbe0b9cc03ab563775b8258290e31f3d0"
        },
        {
          "path": "src/lib/meta-own-company-policy.mjs",
          "sha256": "7db3875cd0f31fec077f4d9a4f8875be1ddf4a5772acff4559069ae950ff0821"
        },
        {
          "path": "src/lib/meta-plan-import-conversation.mjs",
          "sha256": "6f3c261cb2cde943e0202ab5097d664958f5702975cdf5914aeac35e5a1bac1c"
        },
        {
          "path": "src/lib/meta-plan-import-origin.mjs",
          "sha256": "cdb619d1709a982323c9892383def1428db2ade771babdb18e4032b3535d953e"
        },
        {
          "path": "src/lib/meta-plan-import-transport.mjs",
          "sha256": "e42f48f0175dd697bac3de61d7d9893d35c2b1696c1ae276a4698eb3c36a4634"
        },
        {
          "path": "src/lib/meta-test-recipient-binding.mjs",
          "sha256": "2aea6f5815bd2d90fe891b45a79b48d339a3eebc681ac40b3347244e546c4b66"
        },
        {
          "path": "src/lib/meta-whatsapp-transport.mjs",
          "sha256": "f99569c7f587e9be1268aa254d2368226346a7ebf7e48fa6ca63a0064cf41310"
        },
        {
          "path": "src/lib/organization-resource-usage-policy.mjs",
          "sha256": "089ac1ee2ca6afd30aab1d0abd38274698ca56991d1c5225ea8e44c8b9fdc449"
        },
        {
          "path": "src/lib/organization-usage-policy.mjs",
          "sha256": "94997530d6c1fd420f0233172b07f8ba7dd7546a2ac9af75eaa30736400237ae"
        },
        {
          "path": "src/lib/participant-account-discovery.mjs",
          "sha256": "11b37ca397fdb195aac7addc1c16842fb28a9c83a73a82a57bf2791ed3038738"
        },
        {
          "path": "src/lib/participant-admission.mjs",
          "sha256": "2cbb466e49d742cd23da1bb85a4e89b7e411dc724c8d1f2eb66b39717f283dd9"
        },
        {
          "path": "src/lib/participant-analysis-consent.mjs",
          "sha256": "7f7d371914d1e46ac799cd1683afdc0418186c15a20156e697ecd879c81bf8c1"
        },
        {
          "path": "src/lib/participant-approved-identity.mjs",
          "sha256": "834d81e70cedbd967ff84d880ea9d697c2168d2220fb23d9eb14c1aba1cdbbf1"
        },
        {
          "path": "src/lib/participant-bank-account.mjs",
          "sha256": "29980527a6eda3bbc0125098a4b616082034a71fb1afb772ff87f476bc0ce981"
        },
        {
          "path": "src/lib/participant-bank-format.mjs",
          "sha256": "ebbb206a14eaac57230b53ec1afae99c4be60c8739baf0d1d047d4a47ba464db"
        },
        {
          "path": "src/lib/participant-bank-vault.mjs",
          "sha256": "06e990ab79c896628756f3c74a50dcc7e8062f4fa296f56a31e4150b5badc16a"
        },
        {
          "path": "src/lib/participant-channel-kyc.mjs",
          "sha256": "2ac9414429238162a9b16d4adea421df0bff9fb93ea4fbf2f9d6677f2659fb2d"
        },
        {
          "path": "src/lib/participant-civil-policy.mjs",
          "sha256": "e180a64c788d6cd20e766cb4fd32dbba1c7cb3954c01405ac8675ec023eef278"
        },
        {
          "path": "src/lib/participant-civil-store.mjs",
          "sha256": "5f440c0c76ca67b87a7e5d4e90e7a48f18ea3603b16434b35beeddd3bdf168a4"
        },
        {
          "path": "src/lib/participant-kyc-chat-attempt.mjs",
          "sha256": "d3f0a65f866fa027ee008963fcb6ffcad0cd33de94cace7603cf40bc78c21aeb"
        },
        {
          "path": "src/lib/participant-kyc-chat-closure.mjs",
          "sha256": "4a6a368910de95582c2baabc70bab7f4b4afa4413e8ebdb75a1e8b867c098a19"
        },
        {
          "path": "src/lib/participant-kyc-chat-copy.mjs",
          "sha256": "d886219584d5e8b9d9db1ad16a36c726f6982fa0e8400c3be51af2623574ab96"
        },
        {
          "path": "src/lib/participant-kyc-image-set.mjs",
          "sha256": "190ce2560286a58d42668da7b912aeabcfa76ee14086503bf1609304e5f0e8fb"
        },
        {
          "path": "src/lib/participant-kyc-notice-links.mjs",
          "sha256": "3547f3fc2ebdefc2522971467d4c77498160dde7806a25bf9fa18c527c8658fc"
        },
        {
          "path": "src/lib/participant-kyc-preanalysis-policy.mjs",
          "sha256": "8c5286a0a5d41364e92e60f2ce2ba96caccc8667960f966b5caead37acafab49"
        },
        {
          "path": "src/lib/participant-onboarding-authority.mjs",
          "sha256": "dad5d9fd0a61c493ff02331d5333982627cdeb3a7addb74a3c86d44da931f916"
        },
        {
          "path": "src/lib/participant-onboarding-current-kyc.mjs",
          "sha256": "232fecca4f6cf775e5151ec460560e0c1abd6646dc3c532140cabe26dfb42119"
        },
        {
          "path": "src/lib/participant-onboarding-delivery.mjs",
          "sha256": "615592cc1a6215e24c48e8873a27211421853f99ca9093e6f490f77532b3d013"
        },
        {
          "path": "src/lib/participant-onboarding-intent.mjs",
          "sha256": "07114f6066e10617357c4e5d8e2db2b9dc846e5f4cffbc5aef09f2b7bfada9de"
        },
        {
          "path": "src/lib/participant-onboarding-policy.mjs",
          "sha256": "59409797ce3e13b7cfe63fe21d8d7e2c848ee49e0766015939242a9f43687c03"
        },
        {
          "path": "src/lib/participant-onboarding-reactive.mjs",
          "sha256": "666a8c27f3ab7d6fdbe66c91f22ace4e25b04b98e865f401d19c72212916104d"
        },
        {
          "path": "src/lib/participant-policy.mjs",
          "sha256": "7f3969ab1ebac5f01696149d76337199eb64c2fd09015c44c07e8b7e7088d62f"
        },
        {
          "path": "src/lib/participant-store.mjs",
          "sha256": "2296495e366b9ea0c2511066584e93ddf1cff51b5eefd05c6121d2143d78f5c9"
        },
        {
          "path": "src/lib/participant-verified-office.mjs",
          "sha256": "4922f392490aa6d49b8a8a45a56ac0b03831a8ad2efe89ce1e3adfd77d603d89"
        },
        {
          "path": "src/lib/person-worksite-journey.mjs",
          "sha256": "d3174df793150125c0b6a5d9f37d56336e72cab1efb43a361065b78ac54c210a"
        },
        {
          "path": "src/lib/pilot-media.mjs",
          "sha256": "55e35757cea03c312df68cebad100ee8b7d904b418eca9082359ea34e68f8fa9"
        },
        {
          "path": "src/lib/plan-baseline-policy.mjs",
          "sha256": "e9217a41a87057f437439420d56f3b7a0f973ae37c250c07b335634fef308560"
        },
        {
          "path": "src/lib/plan-budget-source.mjs",
          "sha256": "7ebeabf62d8fb89c6ab941b8130d196ca2e008959a9599f2db0c71d75dd3382a"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/plan-import-monthly-curve.mjs",
          "sha256": "6ce785f9c24c47f0e291b0bac40bd96a691fae68a309e4cb7a1917db31f9e6b6"
        },
        {
          "path": "src/lib/plan-import-ooxml.mjs",
          "sha256": "662abaa7523d74961c6873a8b0beb3eb7e3d3b52988fad9cc55e76c0e540a3bd"
        },
        {
          "path": "src/lib/plan-import-policy.mjs",
          "sha256": "1946b2793d0db11519d154acdb5bf0f7e8be5dc26ecd1971b846eed284d7d50f"
        },
        {
          "path": "src/lib/plan-import-store.mjs",
          "sha256": "da047723f790c0f5e7eeff855782e4db7463670d1875caf0bab1c6cce9b1a920"
        },
        {
          "path": "src/lib/plan-measurement-policy.mjs",
          "sha256": "3d6b0bce58a7f89612878310f534d8cf02f6a222c778cd4294b415c1f61157b7"
        },
        {
          "path": "src/lib/plan-measurement-source.mjs",
          "sha256": "ecf33b67a333d8ce73bfb51610218a1658cd94a26b62eb35d2290b795f826f36"
        },
        {
          "path": "src/lib/private-image-upload.mjs",
          "sha256": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60"
        },
        {
          "path": "src/lib/procurement-quantity.js",
          "sha256": "53439844051cc1dbd679220d695e60e54bc1629b2f1ddb33fc125981da9326b3"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/site-register-policy.mjs",
          "sha256": "d529c4f2225e0ec851ef7df60f8c5b182a88b384958ebfd15b194683d1590434"
        },
        {
          "path": "src/lib/site-register-store.mjs",
          "sha256": "6b744c86f47dbb6dc081132675888615d76421701f96151b00646b5e1d2529c6"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/video-audio-extractor.mjs",
          "sha256": "0c85dfd39c10fdb782eca4fe57dc665c29bd7211ab7aba0dda3f8945abcb1988"
        },
        {
          "path": "src/lib/video-frame-extractor.mjs",
          "sha256": "33425a184cf097884982c43a90e3b515726027adbeb51c2cdbfc794e79dee6e6"
        },
        {
          "path": "src/lib/voice-consumption-draft.mjs",
          "sha256": "b9af424825674ca6f24a729e9ba89bae6e67adf433de10837a05e58900584c82"
        },
        {
          "path": "src/lib/voice-progress-draft.mjs",
          "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
        },
        {
          "path": "src/lib/whatsapp/field-worker-intent-policy.js",
          "sha256": "0fdf205af1c2185a16f99c4f1aaba6c36d95722ea914915a0eefe6a10d443ef9"
        },
        {
          "path": "src/lib/whatsapp/obra-intent-policy.js",
          "sha256": "cd01054ba81be6552f58dc91758e08166ea099482f28355cae570d15f3ccf8da"
        },
        {
          "path": "src/lib/whatsapp/operational-proposal-decision-policy.js",
          "sha256": "996ed641c090267679ce0fc3cb7a23f39b31ce88e761135feb0dd0c852eb74fc"
        },
        {
          "path": "src/lib/whatsapp/project-workspace-profile.js",
          "sha256": "e13473baa4ca5b4dc9851bb202f400ba174ccbfce2589be65ce8458aafa998f4"
        },
        {
          "path": "src/lib/whatsapp/template-review-policy.js",
          "sha256": "0ec4a7e544f8c2c2409d2c84ecf69fab663334dd5a5cef0ee1b1cbec82de0a08"
        },
        {
          "path": "src/lib/whatsapp/tenant-workspace-policy.js",
          "sha256": "d3416ff993fbfd70f75404166cdcd8f0b9b2e5a6741f6cde03725aab16abcd5e"
        },
        {
          "path": "src/lib/worker-channel-consent-policy.mjs",
          "sha256": "95c8393e7f2603694c5c15cfe34c9eead43007927aed0d5b633859b14c7448a9"
        },
        {
          "path": "src/lib/worker-channel-identity.mjs",
          "sha256": "1cddd58a2cd656abaca25752481fe1ca760d2bcd385a0fffbe0e685c15d59e0a"
        },
        {
          "path": "src/lib/workspace-policy.mjs",
          "sha256": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e"
        },
        {
          "path": "src/lib/workspace-store.mjs",
          "sha256": "5f25092121a31a06eefa59d69866db82fa3cd28afdcbd0e066e52d916478bc50"
        }
      ]
    },
    {
      "family": "ORGANIZATION_USAGE_UI",
      "previousFiles": [
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/company-subscription-panel.js",
        "src/app/(identity)/cuenta/company-subscription-panel.module.css",
        "src/app/(identity)/cuenta/company-subscription-view.mjs",
        "src/app/(identity)/cuenta/company-usage-panel.js",
        "src/app/(identity)/cuenta/company-usage-view.mjs",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-import-calendar-suggestions.mjs",
        "src/app/(identity)/cuenta/plan-import-panel.js",
        "src/app/(identity)/cuenta/plan-import-panel.module.css",
        "src/app/(identity)/cuenta/plan-import-usage-view.mjs",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.js",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.js",
        "src/app/(identity)/cuenta/plan-partida-source-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.module.css",
        "src/app/(identity)/cuenta/plan-source-curve.js",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.module.css",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/lib/company-entitlement.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs"
      ],
      "previousExternalImports": [
        "lucide-react",
        "react"
      ],
      "currentFiles": [
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/company-subscription-panel.js",
        "src/app/(identity)/cuenta/company-subscription-panel.module.css",
        "src/app/(identity)/cuenta/company-subscription-view.mjs",
        "src/app/(identity)/cuenta/company-usage-panel.js",
        "src/app/(identity)/cuenta/company-usage-view.mjs",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-import-calendar-suggestions.mjs",
        "src/app/(identity)/cuenta/plan-import-panel.js",
        "src/app/(identity)/cuenta/plan-import-panel.module.css",
        "src/app/(identity)/cuenta/plan-import-usage-view.mjs",
        "src/app/(identity)/cuenta/plan-partida-budget-preview.js",
        "src/app/(identity)/cuenta/plan-partida-budget-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.js",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.js",
        "src/app/(identity)/cuenta/plan-partida-source-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.module.css",
        "src/app/(identity)/cuenta/plan-source-curve.js",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.module.css",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/lib/company-entitlement.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs"
      ],
      "externalImports": [
        "lucide-react",
        "react"
      ],
      "currentManifest": [
        {
          "path": "src/app/(identity)/cuenta/company-channel-view.mjs",
          "sha256": "c79c473999e444b84e2a1d58e0d03f030069c24f9749f2c84450318b0b237e4d"
        },
        {
          "path": "src/app/(identity)/cuenta/company-subscription-panel.js",
          "sha256": "0b208fdcbea4900bd6adf86ad80f8524b5afa647d78a24fbf5731d3d7d79c749"
        },
        {
          "path": "src/app/(identity)/cuenta/company-subscription-panel.module.css",
          "sha256": "fdede43a09f48b011f7e3cb184ea16bf0be0e98069e7a953b71b8e391b3dfa3e"
        },
        {
          "path": "src/app/(identity)/cuenta/company-subscription-view.mjs",
          "sha256": "d009632c97d18084a1907bd7dedcf140f1a5d4ee0b55dd95f33d83be152dfc9c"
        },
        {
          "path": "src/app/(identity)/cuenta/company-usage-panel.js",
          "sha256": "01beddb3b88861bda1549169cc885bc682bd5446e4289521e5a36a6386ac37aa"
        },
        {
          "path": "src/app/(identity)/cuenta/company-usage-view.mjs",
          "sha256": "27cb4b607405186f57d70ffa7d78b1b2f9456486a4bfeb40b0157c9c52a2dc29"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-number-view.mjs",
          "sha256": "6940f11e30d2958d7f6771463ce28ca83c0e2d2f41e81aa220c8efe669580300"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-templates-view.mjs",
          "sha256": "3bf758b150336613a437e2b01d3b6a79645a024b771f1515f4ec2ae58a1b8bc3"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-office-account-view.mjs",
          "sha256": "f2716f72297a1277946bafa03a82d4c1fb7f2fcff7f4c4bbe155a86ed7e4e379"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline-view.mjs",
          "sha256": "0c696eba748a7441440e23be5085dc42d4954427def5adc1e2de686b4b11711d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-calendar-suggestions.mjs",
          "sha256": "be73d51220557e395295700a238024d9896ef627a305718518214fc7bd227457"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-panel.js",
          "sha256": "19b79557ed1fa8d5db6d1a46201d925ea1ffc601cedb100da42bfe0768410dbf"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-panel.module.css",
          "sha256": "c64771e75e83b6708ede012f90636bac1d13c19a3c1088c685513e702cc69061"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-usage-view.mjs",
          "sha256": "666668e0267f77599f191ca5ffa038da11232ad8bb08806d2b46d9193994a186"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-budget-preview.js",
          "sha256": "89868285a7cdd7a8e6f024d2e4924d45f3c811c7a24c4afe4655611f21998c15"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-budget-preview.mjs",
          "sha256": "b6f64911f619ca1f999a4fffbb26c97b94c85e33bc49bd251d55676dd63208fa"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-measurement-preview.js",
          "sha256": "e68aa0851e4d415408c21df76d3716c4e4196925223c155a96194d7db85566d8"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-measurement-preview.mjs",
          "sha256": "f30a1c21396f61a1808446d9660554132b5df654e633d128dfe2f76336a9adc5"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-source-preview.js",
          "sha256": "a37e9dc27ecc12271c1043d42ca2c3311f66cae7c3fdae6bf961f67bd639e431"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-source-preview.mjs",
          "sha256": "fcd3a41c62138e77fc026c6651a0a228d9f4507b0a87c82a3b113b0e4fc26e8d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-source-preview.module.css",
          "sha256": "301f578a68afa6878e67341f02a47b405444cea63eb6ae44eb86241b1c0da799"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.js",
          "sha256": "b0f1ef1fee082e82f18d4bd2fb13377b27d8f9849e831f2c34120164f93f9a12"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.mjs",
          "sha256": "689402d373744d159a62e2e5975ddfdf79053c528a838879dd5df3e43a0efdc9"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.module.css",
          "sha256": "92f94328baac3fb0416002db12b5c19923fc28e6f89cb625df10038e0a96a180"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-view.mjs",
          "sha256": "58ebd978e8e39423901cb811ecf2ab851160b78f7cd5cb441075d66d7819dee9"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
          "sha256": "3a8d1c517fb084df425198c84671f6b76bb1f659f9d0d4ed94945cd1046d8e64"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
          "sha256": "d8cf1e7e8d88d66f722aaf52deb45f95829c226468d3f37a2b23d171cc1ecbb8"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
          "sha256": "b3004538de2cc7cbc829bf5518c4f4b2a5eb2935d0b4e60f9c88840c8ede3797"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
          "sha256": "590cd7691d8b6beb82929bdd18dd9909c2d2cfa1c3d4111ff4d478d57daf532f"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-session-request.mjs",
          "sha256": "29d294ac1d973317d6a3df225a64a8a9115c6ea51c587f297114e7992af97520"
        },
        {
          "path": "src/lib/company-entitlement.mjs",
          "sha256": "65d41dfb796ef12be38b1220a99ccd3dfe277419a5e5a27e125beb29fe7e2cde"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        }
      ]
    },
    {
      "family": "PLAN_BUDGET_UI",
      "previousFiles": [],
      "previousExternalImports": [],
      "currentFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/home-decisions-current-ci-lineage.mjs",
        "scripts/lib/plan-budget-browser-ui.mjs",
        "scripts/lib/plan-budget-current-ci-lineage.mjs",
        "scripts/lib/plan-budget-current-ci-reviewed.mjs",
        "scripts/lib/plan-budget-ui-contract.mjs",
        "scripts/lib/plan-compact-full-suite-ui.mjs",
        "scripts/lib/plan-document-curve-fixture-copy.mjs",
        "scripts/lib/plan-partida-measurement-privacy-ui.mjs",
        "scripts/lib/plan-partida-preview-current-ci-lineage.mjs",
        "scripts/lib/plan-partida-preview-current-ci-reviewed.mjs",
        "scripts/lib/plan-partida-source-preview-ui.mjs",
        "scripts/lib/worksite-live-hours-current-ci-lineage.mjs",
        "scripts/lib/worksite-live-hours-current-ci-reviewed.mjs",
        "scripts/verify-plan-budget-ui.mjs",
        "scripts/verify-plan-import-ui.mjs",
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-import-calendar-suggestions.mjs",
        "src/app/(identity)/cuenta/plan-import-panel.js",
        "src/app/(identity)/cuenta/plan-import-panel.module.css",
        "src/app/(identity)/cuenta/plan-import-usage-view.mjs",
        "src/app/(identity)/cuenta/plan-partida-budget-preview.js",
        "src/app/(identity)/cuenta/plan-partida-budget-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.js",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.js",
        "src/app/(identity)/cuenta/plan-partida-source-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.module.css",
        "src/app/(identity)/cuenta/plan-source-curve.js",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.module.css",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/template-send-view.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-panel.js",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/app/(identity)/cuenta/workspace.module.css",
        "src/lib/organization-resource-usage-policy.mjs",
        "src/lib/organization-resource-usage-store.mjs",
        "src/lib/organization-usage-policy.mjs",
        "src/lib/organization-usage-store.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/plan-baseline-http.mjs",
        "src/lib/plan-baseline-policy.mjs",
        "src/lib/plan-baseline-store.mjs",
        "src/lib/plan-budget-source.mjs",
        "src/lib/plan-import-analyzer.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/plan-import-http.mjs",
        "src/lib/plan-import-monthly-curve.mjs",
        "src/lib/plan-import-ooxml.mjs",
        "src/lib/plan-import-policy.mjs",
        "src/lib/plan-import-store.mjs",
        "src/lib/plan-measurement-policy.mjs",
        "src/lib/plan-measurement-source.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/task-progress-measurement.js",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-store.mjs",
        "tests/fixtures/plan-budget-source-synthetic.mjs",
        "tests/fixtures/plan-budget-store-synthetic.mjs",
        "tests/fixtures/plan-budget-ui-synthetic.mjs",
        "tests/fixtures/plan-document-curve-store-synthetic.mjs",
        "tests/fixtures/plan-import-cyp-curve-synthetic.mjs",
        "tests/fixtures/plan-import-document-curve-synthetic.mjs",
        "tests/fixtures/plan-import-monthly-curve-synthetic.mjs",
        "tests/fixtures/plan-import-ooxml-synthetic.mjs",
        "tests/fixtures/plan-measurement-source-synthetic.mjs"
      ],
      "externalImports": [
        "@babel/parser",
        "lucide-react",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:path",
        "node:url",
        "node:zlib",
        "puppeteer",
        "react",
        "saxes",
        "yauzl"
      ],
      "currentManifest": [
        {
          "path": "package-lock.json",
          "sha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449"
        },
        {
          "path": "package.json",
          "sha256": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d"
        },
        {
          "path": "scripts/lib/home-decisions-current-ci-lineage.mjs",
          "sha256": "bd61edf4351e0d3b8f7857cb26cdc169162dca5400467f2f9fbfbd5853903503"
        },
        {
          "path": "scripts/lib/plan-budget-browser-ui.mjs",
          "sha256": "67ca623eef0518314e53f7a92ec19f818f698b620f0e22833a27593e5a08f5a1"
        },
        {
          "path": "scripts/lib/plan-budget-current-ci-lineage.mjs",
          "sha256": "834a40911ef64844f0db441a48cef5de235ae556c301308a62ff347f7106d678"
        },
        {
          "path": "scripts/lib/plan-budget-current-ci-reviewed.mjs",
          "sha256": "REVIEWED_DECLARATION_TRUST_ANCHOR"
        },
        {
          "path": "scripts/lib/plan-budget-ui-contract.mjs",
          "sha256": "dbe42180825c5fb17e99df81549cc2e5db3782f2112f8d4df5567624022798e4"
        },
        {
          "path": "scripts/lib/plan-compact-full-suite-ui.mjs",
          "sha256": "53169c4a6fd9636daf6172f71b39bb9a759bc9dd48adb6544a31a6d018691b28"
        },
        {
          "path": "scripts/lib/plan-document-curve-fixture-copy.mjs",
          "sha256": "05eb49f3948bef7d95580d5ee1bda3cf3c4592e235440a2dbfdb760c2fcb781e"
        },
        {
          "path": "scripts/lib/plan-partida-measurement-privacy-ui.mjs",
          "sha256": "816b9a435d37194e91660bfd3157560f66409ca0499396df9ab1e9fea0f4e27c"
        },
        {
          "path": "scripts/lib/plan-partida-preview-current-ci-lineage.mjs",
          "sha256": "141f5d6decf74d9dc126399ac955ac27874da785fd6c5df5f8af7bc0244d4e75"
        },
        {
          "path": "scripts/lib/plan-partida-preview-current-ci-reviewed.mjs",
          "sha256": "f908107cd26280c1b8e1001d9aeb5bc00107c0d7b39feb9b7ec2c1d539aa3e04"
        },
        {
          "path": "scripts/lib/plan-partida-source-preview-ui.mjs",
          "sha256": "f20fb29956212a459890e119c242f0bdb9e0fd67ced7fca32e2c2d06cad14057"
        },
        {
          "path": "scripts/lib/worksite-live-hours-current-ci-lineage.mjs",
          "sha256": "c78c0792ec6c9142b76090bdffc65fc026a5b333a473e833a203981bec96f448"
        },
        {
          "path": "scripts/lib/worksite-live-hours-current-ci-reviewed.mjs",
          "sha256": "8da86cb1eeb978e37843d4f722da44968e4a089fd719aa35ebd966395f784758"
        },
        {
          "path": "scripts/verify-plan-budget-ui.mjs",
          "sha256": "15c3bd2cc174a773dcc1a9e2aaa289cc60bb7a3b6f3a1a84606180d1bcaace60"
        },
        {
          "path": "scripts/verify-plan-import-ui.mjs",
          "sha256": "d85d5f2d21f3da43dcb66216d05798d9b2b5cdf2134b212be493a386a00301af"
        },
        {
          "path": "src/app/(identity)/cuenta/company-channel-view.mjs",
          "sha256": "c79c473999e444b84e2a1d58e0d03f030069c24f9749f2c84450318b0b237e4d"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-number-view.mjs",
          "sha256": "6940f11e30d2958d7f6771463ce28ca83c0e2d2f41e81aa220c8efe669580300"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-templates-view.mjs",
          "sha256": "3bf758b150336613a437e2b01d3b6a79645a024b771f1515f4ec2ae58a1b8bc3"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-office-account-view.mjs",
          "sha256": "f2716f72297a1277946bafa03a82d4c1fb7f2fcff7f4c4bbe155a86ed7e4e379"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline-view.mjs",
          "sha256": "0c696eba748a7441440e23be5085dc42d4954427def5adc1e2de686b4b11711d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-calendar-suggestions.mjs",
          "sha256": "be73d51220557e395295700a238024d9896ef627a305718518214fc7bd227457"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-panel.js",
          "sha256": "19b79557ed1fa8d5db6d1a46201d925ea1ffc601cedb100da42bfe0768410dbf"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-panel.module.css",
          "sha256": "c64771e75e83b6708ede012f90636bac1d13c19a3c1088c685513e702cc69061"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-usage-view.mjs",
          "sha256": "666668e0267f77599f191ca5ffa038da11232ad8bb08806d2b46d9193994a186"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-budget-preview.js",
          "sha256": "89868285a7cdd7a8e6f024d2e4924d45f3c811c7a24c4afe4655611f21998c15"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-budget-preview.mjs",
          "sha256": "b6f64911f619ca1f999a4fffbb26c97b94c85e33bc49bd251d55676dd63208fa"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-measurement-preview.js",
          "sha256": "e68aa0851e4d415408c21df76d3716c4e4196925223c155a96194d7db85566d8"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-measurement-preview.mjs",
          "sha256": "f30a1c21396f61a1808446d9660554132b5df654e633d128dfe2f76336a9adc5"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-source-preview.js",
          "sha256": "a37e9dc27ecc12271c1043d42ca2c3311f66cae7c3fdae6bf961f67bd639e431"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-source-preview.mjs",
          "sha256": "fcd3a41c62138e77fc026c6651a0a228d9f4507b0a87c82a3b113b0e4fc26e8d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-source-preview.module.css",
          "sha256": "301f578a68afa6878e67341f02a47b405444cea63eb6ae44eb86241b1c0da799"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.js",
          "sha256": "b0f1ef1fee082e82f18d4bd2fb13377b27d8f9849e831f2c34120164f93f9a12"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.mjs",
          "sha256": "689402d373744d159a62e2e5975ddfdf79053c528a838879dd5df3e43a0efdc9"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.module.css",
          "sha256": "92f94328baac3fb0416002db12b5c19923fc28e6f89cb625df10038e0a96a180"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-view.mjs",
          "sha256": "58ebd978e8e39423901cb811ecf2ab851160b78f7cd5cb441075d66d7819dee9"
        },
        {
          "path": "src/app/(identity)/cuenta/template-send-view.mjs",
          "sha256": "703415b8dab1a575ebb54c9273049d2b940f93994add7177255ae26918672940"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
          "sha256": "3a8d1c517fb084df425198c84671f6b76bb1f659f9d0d4ed94945cd1046d8e64"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-panel.js",
          "sha256": "063361bf78293a61a246195d5734f69a17b08c5781ae5c9f502b85dcc51ef883"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
          "sha256": "d8cf1e7e8d88d66f722aaf52deb45f95829c226468d3f37a2b23d171cc1ecbb8"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
          "sha256": "b3004538de2cc7cbc829bf5518c4f4b2a5eb2935d0b4e60f9c88840c8ede3797"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
          "sha256": "590cd7691d8b6beb82929bdd18dd9909c2d2cfa1c3d4111ff4d478d57daf532f"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-session-request.mjs",
          "sha256": "29d294ac1d973317d6a3df225a64a8a9115c6ea51c587f297114e7992af97520"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace.module.css",
          "sha256": "dfce6eb468fee571af0d0f371e68848274f22198faf89c0a6cdd5df5edc7e7a9"
        },
        {
          "path": "src/lib/organization-resource-usage-policy.mjs",
          "sha256": "089ac1ee2ca6afd30aab1d0abd38274698ca56991d1c5225ea8e44c8b9fdc449"
        },
        {
          "path": "src/lib/organization-resource-usage-store.mjs",
          "sha256": "869502cd3b11d1625c4dbb843ebc53d92e43dd21d13fcb53f22538684ec4f2ef"
        },
        {
          "path": "src/lib/organization-usage-policy.mjs",
          "sha256": "94997530d6c1fd420f0233172b07f8ba7dd7546a2ac9af75eaa30736400237ae"
        },
        {
          "path": "src/lib/organization-usage-store.mjs",
          "sha256": "9497c32b76ffda1d5456267d4fcdc90b674618df1d60bd84dbbd7bc3b2827347"
        },
        {
          "path": "src/lib/participant-admission.mjs",
          "sha256": "2cbb466e49d742cd23da1bb85a4e89b7e411dc724c8d1f2eb66b39717f283dd9"
        },
        {
          "path": "src/lib/participant-approved-identity.mjs",
          "sha256": "834d81e70cedbd967ff84d880ea9d697c2168d2220fb23d9eb14c1aba1cdbbf1"
        },
        {
          "path": "src/lib/participant-kyc-image-set.mjs",
          "sha256": "190ce2560286a58d42668da7b912aeabcfa76ee14086503bf1609304e5f0e8fb"
        },
        {
          "path": "src/lib/plan-baseline-http.mjs",
          "sha256": "8bc07e9d2dcd3c5ee7e80dc071e8f519b647027474410b260de607e3d1aa036d"
        },
        {
          "path": "src/lib/plan-baseline-policy.mjs",
          "sha256": "e9217a41a87057f437439420d56f3b7a0f973ae37c250c07b335634fef308560"
        },
        {
          "path": "src/lib/plan-baseline-store.mjs",
          "sha256": "7ef5a09691889a0e5de3211c3b0b246f948eb772c0416ea3ed3c2675698d49cb"
        },
        {
          "path": "src/lib/plan-budget-source.mjs",
          "sha256": "7ebeabf62d8fb89c6ab941b8130d196ca2e008959a9599f2db0c71d75dd3382a"
        },
        {
          "path": "src/lib/plan-import-analyzer.mjs",
          "sha256": "a132a09a7f69f218a244a46f55b9da9d873bae33c753f9d73c8c15a7daaeb9c0"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/plan-import-http.mjs",
          "sha256": "6bab716742d634eb11abbcb7b791507084c0c345cf98e7012668993be4deec1c"
        },
        {
          "path": "src/lib/plan-import-monthly-curve.mjs",
          "sha256": "6ce785f9c24c47f0e291b0bac40bd96a691fae68a309e4cb7a1917db31f9e6b6"
        },
        {
          "path": "src/lib/plan-import-ooxml.mjs",
          "sha256": "662abaa7523d74961c6873a8b0beb3eb7e3d3b52988fad9cc55e76c0e540a3bd"
        },
        {
          "path": "src/lib/plan-import-policy.mjs",
          "sha256": "1946b2793d0db11519d154acdb5bf0f7e8be5dc26ecd1971b846eed284d7d50f"
        },
        {
          "path": "src/lib/plan-import-store.mjs",
          "sha256": "da047723f790c0f5e7eeff855782e4db7463670d1875caf0bab1c6cce9b1a920"
        },
        {
          "path": "src/lib/plan-measurement-policy.mjs",
          "sha256": "3d6b0bce58a7f89612878310f534d8cf02f6a222c778cd4294b415c1f61157b7"
        },
        {
          "path": "src/lib/plan-measurement-source.mjs",
          "sha256": "ecf33b67a333d8ce73bfb51610218a1658cd94a26b62eb35d2290b795f826f36"
        },
        {
          "path": "src/lib/private-image-upload.mjs",
          "sha256": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/workspace-policy.mjs",
          "sha256": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e"
        },
        {
          "path": "src/lib/workspace-store.mjs",
          "sha256": "5f25092121a31a06eefa59d69866db82fa3cd28afdcbd0e066e52d916478bc50"
        },
        {
          "path": "tests/fixtures/plan-budget-source-synthetic.mjs",
          "sha256": "bf66364fbf41037c535c33b3aac59c750c2e19bf2a757c6564ac47b51665f241"
        },
        {
          "path": "tests/fixtures/plan-budget-store-synthetic.mjs",
          "sha256": "86f8ba219c29aa70298c9998b45cd0e66c888cc277690ad43c28f30d47fd88d1"
        },
        {
          "path": "tests/fixtures/plan-budget-ui-synthetic.mjs",
          "sha256": "e6e03b516d0301717c3f8daa0711c46610efb672eb4c7e83efcaf69959903bb3"
        },
        {
          "path": "tests/fixtures/plan-document-curve-store-synthetic.mjs",
          "sha256": "960b019ae105d541641372d9e2fa24081a25fe96c1251a1afd6c20ff9c69ec44"
        },
        {
          "path": "tests/fixtures/plan-import-cyp-curve-synthetic.mjs",
          "sha256": "a4bedd3fe4d8f5d3011b054d85585739e2d948d14c86bc4bd63fc5f310af8704"
        },
        {
          "path": "tests/fixtures/plan-import-document-curve-synthetic.mjs",
          "sha256": "59b85a8489363c6d78bc33eb77a0b8eb8e6464112934cdb26eedc247536dc71f"
        },
        {
          "path": "tests/fixtures/plan-import-monthly-curve-synthetic.mjs",
          "sha256": "ec9e7d0a3126daa7b1144ce4c8d3c15c8c42d43d97b367fb8276dcffe87c6c6a"
        },
        {
          "path": "tests/fixtures/plan-import-ooxml-synthetic.mjs",
          "sha256": "4157135abf5798807025a18abd121c7fdbc7be2a5e0099084bbb02ea28f20931"
        },
        {
          "path": "tests/fixtures/plan-measurement-source-synthetic.mjs",
          "sha256": "9e62b4d9caef2f739e3624e13f7c0cb14c6f1d9a7e2266801a45bf7fb367410c"
        }
      ]
    }
  ],
  "ownership": {
    "block": {
      "id": 66,
      "step": {
        "name": "Read-only budget source contracts and exact synthetic browser supplement",
        "run": "npx eslint src/lib/plan-budget-source.mjs scripts/lib/plan-budget-*.mjs scripts/verify-plan-budget-ui.mjs tests/fixtures/plan-budget-source-synthetic.mjs tests/fixtures/plan-budget-store-synthetic.mjs tests/production-plan-budget*.test.mjs --max-warnings 0\nnode --test tests/production-plan-budget*.test.mjs\nnode scripts/verify-plan-budget-ui.mjs --expected-head \"$GITHUB_SHA\"\n"
      },
      "commandSha256": "c09182b47d12ff49f1aa39189779c8327af539dcc56b4c307b903c5aa0a42f75"
    },
    "producer": {
      "producer": "scripts/verify-plan-budget-ui.mjs",
      "path": ".vercel/private/plan-budget-ui-ci.json",
      "retained": true,
      "blockId": 66,
      "lane": "plans",
      "sourceLine": 20,
      "producerSha256": "15c3bd2cc174a773dcc1a9e2aaa289cc60bb7a3b6f3a1a84606180d1bcaace60",
      "sourceBasis": "EXPECTED_HEAD_GIT_BYTES"
    },
    "proof": {
      "id": "budget-source-ui",
      "lane": "plans",
      "blockId": 66,
      "path": ".vercel/private/plan-budget-ui-ci.json",
      "kind": "UI_PLAN_BUDGET_SOURCE",
      "producer": "scripts/verify-plan-budget-ui.mjs",
      "producerSha256": "15c3bd2cc174a773dcc1a9e2aaa289cc60bb7a3b6f3a1a84606180d1bcaace60",
      "sourceFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/home-decisions-current-ci-lineage.mjs",
        "scripts/lib/plan-budget-browser-ui.mjs",
        "scripts/lib/plan-budget-current-ci-lineage.mjs",
        "scripts/lib/plan-budget-current-ci-reviewed.mjs",
        "scripts/lib/plan-budget-ui-contract.mjs",
        "scripts/lib/plan-compact-full-suite-ui.mjs",
        "scripts/lib/plan-document-curve-fixture-copy.mjs",
        "scripts/lib/plan-partida-measurement-privacy-ui.mjs",
        "scripts/lib/plan-partida-preview-current-ci-lineage.mjs",
        "scripts/lib/plan-partida-preview-current-ci-reviewed.mjs",
        "scripts/lib/plan-partida-source-preview-ui.mjs",
        "scripts/lib/worksite-live-hours-current-ci-lineage.mjs",
        "scripts/lib/worksite-live-hours-current-ci-reviewed.mjs",
        "scripts/verify-plan-budget-ui.mjs",
        "scripts/verify-plan-import-ui.mjs",
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-import-calendar-suggestions.mjs",
        "src/app/(identity)/cuenta/plan-import-panel.js",
        "src/app/(identity)/cuenta/plan-import-panel.module.css",
        "src/app/(identity)/cuenta/plan-import-usage-view.mjs",
        "src/app/(identity)/cuenta/plan-partida-budget-preview.js",
        "src/app/(identity)/cuenta/plan-partida-budget-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.js",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.js",
        "src/app/(identity)/cuenta/plan-partida-source-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.module.css",
        "src/app/(identity)/cuenta/plan-source-curve.js",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.module.css",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/template-send-view.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-panel.js",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/app/(identity)/cuenta/workspace.module.css",
        "src/lib/organization-resource-usage-policy.mjs",
        "src/lib/organization-resource-usage-store.mjs",
        "src/lib/organization-usage-policy.mjs",
        "src/lib/organization-usage-store.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/plan-baseline-http.mjs",
        "src/lib/plan-baseline-policy.mjs",
        "src/lib/plan-baseline-store.mjs",
        "src/lib/plan-budget-source.mjs",
        "src/lib/plan-import-analyzer.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/plan-import-http.mjs",
        "src/lib/plan-import-monthly-curve.mjs",
        "src/lib/plan-import-ooxml.mjs",
        "src/lib/plan-import-policy.mjs",
        "src/lib/plan-import-store.mjs",
        "src/lib/plan-measurement-policy.mjs",
        "src/lib/plan-measurement-source.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/task-progress-measurement.js",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-store.mjs",
        "tests/fixtures/plan-budget-source-synthetic.mjs",
        "tests/fixtures/plan-budget-store-synthetic.mjs",
        "tests/fixtures/plan-budget-ui-synthetic.mjs",
        "tests/fixtures/plan-document-curve-store-synthetic.mjs",
        "tests/fixtures/plan-import-cyp-curve-synthetic.mjs",
        "tests/fixtures/plan-import-document-curve-synthetic.mjs",
        "tests/fixtures/plan-import-monthly-curve-synthetic.mjs",
        "tests/fixtures/plan-import-ooxml-synthetic.mjs",
        "tests/fixtures/plan-measurement-source-synthetic.mjs"
      ],
      "checkNames": [
        "UPLOAD_ADMIN:320",
        "THREE_VIEWS_EXACT_JOIN:320",
        "AMBIGUOUS_SOURCE:320",
        "TRUNCATED_LIST:320",
        "ROLE_DOWNGRADE:320",
        "HTML_403:320",
        "CONTEXT_LATE_SUCCESS:320",
        "OLD_OWNER_LATE_403:320",
        "DETAIL_FALSE_AUTHORITY:320",
        "UPLOAD_ADMIN:390",
        "THREE_VIEWS_EXACT_JOIN:390",
        "UPLOAD_ADMIN:768",
        "THREE_VIEWS_EXACT_JOIN:768",
        "UPLOAD_ADMIN:1280",
        "UPLOAD_DIRECTOR:1280",
        "THREE_VIEWS_EXACT_JOIN:1280",
        "AMBIGUOUS_SOURCE:1280",
        "TRUNCATED_LIST:1280",
        "ROLE_DOWNGRADE:1280",
        "HTML_403:1280",
        "CONTEXT_LATE_SUCCESS:1280",
        "OLD_OWNER_LATE_403:1280",
        "DETAIL_FALSE_AUTHORITY:1280"
      ]
    },
    "retainedArtifact": ".vercel/private/plan-budget-ui-ci.json"
  },
  "browser": {
    "producer": "scripts/verify-plan-import-ui.mjs",
    "producerLfSha256": "d85d5f2d21f3da43dcb66216d05798d9b2b5cdf2134b212be493a386a00301af",
    "investmentSourceCount": 32,
    "investmentSourcePathsSha256": "148a40015bed37bc96406509884b6cbc0fa738ee60e8177289edc0010b42e3ad",
    "historicalCheckCount": 180,
    "supplementCheckCount": 23,
    "combinedCheckCount": 203,
    "rawSupplementPath": ".vercel/private/plan-budget-ui-validation.json",
    "ciProofPath": ".vercel/private/plan-budget-ui-ci.json",
    "retainedScreenshots": [
      {
        "mode": "UPLOAD_ADMIN",
        "width": 320,
        "path": ".vercel/private/plan-import-ui-budget-upload_admin-320.png"
      },
      {
        "mode": "THREE_VIEWS_EXACT_JOIN",
        "width": 320,
        "path": ".vercel/private/plan-import-ui-budget-three_views_exact_join-320.png"
      },
      {
        "mode": "AMBIGUOUS_SOURCE",
        "width": 320,
        "path": ".vercel/private/plan-import-ui-budget-ambiguous_source-320.png"
      },
      {
        "mode": "TRUNCATED_LIST",
        "width": 320,
        "path": ".vercel/private/plan-import-ui-budget-truncated_list-320.png"
      },
      {
        "mode": "ROLE_DOWNGRADE",
        "width": 320,
        "path": ".vercel/private/plan-import-ui-budget-role_downgrade-320.png"
      },
      {
        "mode": "HTML_403",
        "width": 320,
        "path": ".vercel/private/plan-import-ui-budget-html_403-320.png"
      },
      {
        "mode": "CONTEXT_LATE_SUCCESS",
        "width": 320,
        "path": ".vercel/private/plan-import-ui-budget-context_late_success-320.png"
      },
      {
        "mode": "OLD_OWNER_LATE_403",
        "width": 320,
        "path": ".vercel/private/plan-import-ui-budget-old_owner_late_403-320.png"
      },
      {
        "mode": "DETAIL_FALSE_AUTHORITY",
        "width": 320,
        "path": ".vercel/private/plan-import-ui-budget-detail_false_authority-320.png"
      },
      {
        "mode": "UPLOAD_ADMIN",
        "width": 390,
        "path": ".vercel/private/plan-import-ui-budget-upload_admin-390.png"
      },
      {
        "mode": "THREE_VIEWS_EXACT_JOIN",
        "width": 390,
        "path": ".vercel/private/plan-import-ui-budget-three_views_exact_join-390.png"
      },
      {
        "mode": "UPLOAD_ADMIN",
        "width": 768,
        "path": ".vercel/private/plan-import-ui-budget-upload_admin-768.png"
      },
      {
        "mode": "THREE_VIEWS_EXACT_JOIN",
        "width": 768,
        "path": ".vercel/private/plan-import-ui-budget-three_views_exact_join-768.png"
      },
      {
        "mode": "UPLOAD_ADMIN",
        "width": 1280,
        "path": ".vercel/private/plan-import-ui-budget-upload_admin-1280.png"
      },
      {
        "mode": "UPLOAD_DIRECTOR",
        "width": 1280,
        "path": ".vercel/private/plan-import-ui-budget-upload_director-1280.png"
      },
      {
        "mode": "THREE_VIEWS_EXACT_JOIN",
        "width": 1280,
        "path": ".vercel/private/plan-import-ui-budget-three_views_exact_join-1280.png"
      },
      {
        "mode": "AMBIGUOUS_SOURCE",
        "width": 1280,
        "path": ".vercel/private/plan-import-ui-budget-ambiguous_source-1280.png"
      },
      {
        "mode": "TRUNCATED_LIST",
        "width": 1280,
        "path": ".vercel/private/plan-import-ui-budget-truncated_list-1280.png"
      },
      {
        "mode": "ROLE_DOWNGRADE",
        "width": 1280,
        "path": ".vercel/private/plan-import-ui-budget-role_downgrade-1280.png"
      },
      {
        "mode": "HTML_403",
        "width": 1280,
        "path": ".vercel/private/plan-import-ui-budget-html_403-1280.png"
      },
      {
        "mode": "CONTEXT_LATE_SUCCESS",
        "width": 1280,
        "path": ".vercel/private/plan-import-ui-budget-context_late_success-1280.png"
      },
      {
        "mode": "OLD_OWNER_LATE_403",
        "width": 1280,
        "path": ".vercel/private/plan-import-ui-budget-old_owner_late_403-1280.png"
      },
      {
        "mode": "DETAIL_FALSE_AUTHORITY",
        "width": 1280,
        "path": ".vercel/private/plan-import-ui-budget-detail_false_authority-1280.png"
      }
    ]
  },
  "nativeOrBrowserAcceptance": false,
  "pilotWhatsAppRuntime": {
    "version": 1,
    "parentHead": "756b788f30ac6d778db3a0867548f0c3c27c5c9f",
    "sourceAdditions": [
      "src/lib/meta-consumption-evidence-catalog.mjs",
      "src/lib/voice-consumption-draft.mjs"
    ],
    "sourceSetAdvances": [
      {
        "family": "UNIT",
        "previousDelta": {
          "family": "UNIT",
          "contractPointer": "/extension/proofs/0/sourceFiles",
          "previousCount": 140,
          "previousPathsSha256": "7104df28ae9391e6038819dee38a1ee1c8b40806a229ed63324943da39ced460",
          "currentCount": 141,
          "currentPathsSha256": "7003e831534130168d05e652d89f98b535462e1c8d093e5f65e7db3403501daa",
          "additions": [
            "src/lib/plan-budget-source.mjs"
          ]
        }
      },
      {
        "family": "UI_BANK",
        "previousDelta": {
          "family": "UI_BANK",
          "contractPointer": "/extension/proofs/3/sourceFiles",
          "previousCount": 144,
          "previousPathsSha256": "e581ca81d4ea63b3573d296b1fea9b318c738df99657657526f94317d8b9fed2",
          "currentCount": 145,
          "currentPathsSha256": "46244d8547a8eb7242a41a58b9615ee4100e9f1e14b85231f62efabf18e11cec",
          "additions": [
            "src/lib/plan-budget-source.mjs"
          ]
        }
      },
      {
        "family": "UI_JOINT",
        "previousDelta": {
          "family": "UI_JOINT",
          "contractPointer": "/extension/proofs/5/sourceFiles",
          "previousCount": 143,
          "previousPathsSha256": "3c7e4b0e5ccbd4d8488e0ba0ad75ccbabe8b683670eed3482e096d7b33cc7e32",
          "currentCount": 144,
          "currentPathsSha256": "5b94dccebc72186728ce946d71061eae8e587f3fecdedf90af86aa3ed08ec025",
          "additions": [
            "src/lib/plan-budget-source.mjs"
          ]
        }
      },
      {
        "family": "UI_CAUSAL",
        "previousDelta": {
          "family": "UI_CAUSAL",
          "contractPointer": "/extension/proofs/6/sourceFiles",
          "previousCount": 143,
          "previousPathsSha256": "3c7e4b0e5ccbd4d8488e0ba0ad75ccbabe8b683670eed3482e096d7b33cc7e32",
          "currentCount": 144,
          "currentPathsSha256": "5b94dccebc72186728ce946d71061eae8e587f3fecdedf90af86aa3ed08ec025",
          "additions": [
            "src/lib/plan-budget-source.mjs"
          ]
        }
      },
      {
        "family": "PG_COMPANY_KYC",
        "previousDelta": {
          "family": "PG_COMPANY_KYC",
          "contractPointer": "/extension/proofs/7/sourceFiles",
          "previousCount": 237,
          "previousPathsSha256": "649f11c2b82a4cfe38090cf6e1adcd1394a9cc719bf1c485bd3cd67a88f2c858",
          "currentCount": 238,
          "currentPathsSha256": "e1a319ae756ba2e85cbd5a5618b0e9777795433ab2ee5e018d0808003ab6b3bd",
          "additions": [
            "src/lib/plan-budget-source.mjs"
          ]
        }
      },
      {
        "family": "PG_FIELD",
        "previousDelta": {
          "family": "PG_FIELD",
          "contractPointer": "/extension/proofs/14/sourceFiles",
          "previousCount": 129,
          "previousPathsSha256": "32b4daffe18d479b78a644499d16034dc3f85442e5e84e4f7a2cc05c8b399c69",
          "currentCount": 130,
          "currentPathsSha256": "d36caf3d5139df02c67a5854a4844d4a8f3bc5a1c5f9446659ee82575acad373",
          "additions": [
            "src/lib/plan-budget-source.mjs"
          ]
        }
      },
      {
        "family": "PG_OVERTIME",
        "previousDelta": {
          "family": "PG_OVERTIME",
          "contractPointer": "/extension/proofs/15/sourceFiles",
          "previousCount": 114,
          "previousPathsSha256": "19f1a9094ddee24870d3f3e2cd963b34fd85def12472e797cabef3af9aac64b5",
          "currentCount": 115,
          "currentPathsSha256": "52b21658a3b32e348bb4fabd274b79af708e8da384fae38667526709dae78db9",
          "additions": [
            "src/lib/plan-budget-source.mjs"
          ]
        }
      },
      {
        "family": "PG_PARTICIPANT_KYC_PREANALYSIS",
        "previousDelta": {
          "family": "PG_PARTICIPANT_KYC_PREANALYSIS",
          "contractPointer": "/extension/proofs/18/sourceFiles",
          "previousCount": 243,
          "previousPathsSha256": "404123db2d7b89f77f508aa9840a93803b878dfc9a9df5dbd9805d5f1426f1b9",
          "currentCount": 246,
          "currentPathsSha256": "10356efa3e8820a28587f31d94f087d294e40d9a4efc791f4512379e1d82f34f",
          "additions": [
            "scripts/lib/plan-budget-current-ci-lineage.mjs",
            "scripts/lib/plan-budget-current-ci-reviewed.mjs",
            "src/lib/plan-budget-source.mjs"
          ]
        }
      },
      {
        "family": "PLAN_MEASUREMENT",
        "previousDelta": {
          "family": "PLAN_MEASUREMENT",
          "contractPointer": null,
          "previousCount": 119,
          "previousPathsSha256": "bbd40a42f7adf860f4121321c30b21275832459282836839c363950bd6848596",
          "currentCount": 120,
          "currentPathsSha256": "1cf2d31c41ec00e88cb3c628788c21a80b482b1a71a1d298301a8427b8d0f224",
          "additions": [
            "src/lib/plan-budget-source.mjs"
          ]
        }
      },
      {
        "family": "CONSUMPTION_FEEDBACK",
        "previousDelta": {
          "family": "CONSUMPTION_FEEDBACK",
          "contractPointer": null,
          "previousCount": 116,
          "previousPathsSha256": "dd3c6b65b19b524342384c789468e113ccbacf527365ecee69bd45186f2bbc92",
          "currentCount": 117,
          "currentPathsSha256": "71259eec664a644d6eb0ed727b4980c71677104d31d58cef7c828caf85c16ce6",
          "additions": [
            "src/lib/plan-budget-source.mjs"
          ]
        }
      },
      {
        "family": "COMPACT",
        "previousDelta": {
          "family": "COMPACT",
          "contractPointer": null,
          "previousCount": 140,
          "previousPathsSha256": "95302675847ab612d6b3a9d5139991fce835d122e665c71373fa23be46c6435a",
          "currentCount": 141,
          "currentPathsSha256": "78ace2186e2a52f6a789ee8b51319080b5171420e465b4a63c03d52c5d0d294f",
          "additions": [
            "src/lib/plan-budget-source.mjs"
          ]
        }
      },
      {
        "family": "ORGANIZATION_USAGE",
        "previousDelta": {
          "family": "ORGANIZATION_USAGE",
          "contractPointer": null,
          "previousCount": 121,
          "previousPathsSha256": "61c6ff93f2afbcd4d561e3e635927c240ac09100ee79616901ddbd24fb60010b",
          "currentCount": 122,
          "currentPathsSha256": "a74d151d097a409a819e5c25f414faa649bb71cc6f214064fee64e5e92bab48a",
          "additions": [
            "src/lib/plan-budget-source.mjs"
          ]
        }
      },
      {
        "family": "KYC_REPLY_FEEDBACK",
        "previousDelta": {
          "family": "KYC_REPLY_FEEDBACK",
          "contractPointer": null,
          "previousCount": 117,
          "previousPathsSha256": "c065cec9a54b9acb73f0cd9b84517326f9686222f7609c0401ad4b7b6bbb6f7c",
          "currentCount": 118,
          "currentPathsSha256": "ae5d7f5332120838562119040901d8d3b09f3e18e649eaa0cb79a6cf583cc685",
          "additions": [
            "src/lib/plan-budget-source.mjs"
          ]
        }
      }
    ],
    "producerDeltas": [
      {
        "producer": "scripts/verify-employee-intake-postgres.mjs",
        "previousSha256": "d571468725a6679b4f03ea78c5a7be187514f616c2e2248d66e62b97dafe1284",
        "currentSha256": "66e406926448dc904316728d33c1d1f6cbc38a356e13bc0adee535b0c8427caf",
        "contractPointers": [
          "/extension/proofs/2/producerSha256"
        ],
        "sourceHistory": {
          "previousBytes": 55955,
          "currentBytes": 56521,
          "inverseHunks": [
            {
              "currentOffsetCharacters": 11903,
              "currentText": " const blocked=await push('HOLA');await processor.process(blocked);assert.equal(sends,0);assert.equal((await query('SELECT count(*)::int AS n FROM public.\"Worker\"')).rows[0].n,0);checks.push('default-off-signed-source-no-send-no-person');await configure(true);\n let current=null,applicationId;const advance=async(message,{plain=false,sender='15550001001'}={})=>{const prior=applicationId?await state(applicationId):null,timestamp=Math.max(Math.floor(Date.now()/1000),prior?.lastMessageTimestamp+(plain?1:0)||0,plain?Math.floor(Date.parse(current.completedAt)/1000)+1:0);const id=await push(message,{sender,reply:plain?null:current?.messageId||null,timestamp});const outcome=await processor.process(id);current=(await query(`SELECT outcome FROM public.\"WebhookEvent\" WHERE id=$1`,[customerOutboundId(id)])).rows[0]?.outcome;assert.equal(outcome.businessApplied,false);assert.equal(current.state,'SENT');return id;};\n const requestAccess=async(sender='15550001001')=>{const welcome=await state(applicationId);assert.equal(welcome.step,'WELCOME');assert.deepEqual(welcome.choices.map(choice=>choice.value),['REQUEST_ACCESS','ACCOUNT']);assert.equal(welcome.consent,false);assert.equal(current.state,'SENT');await advance({type:'interactive',interactive:{list_reply:{id:'intake:'+welcome.nonce+':'+welcome.choices.findIndex(choice=>choice.value==='REQUEST_ACCESS')}}},{sender});assert.equal((await state(applicationId)).step,'NAME');};\n applicationId=await advance('HOLA');await requestAccess();await advance('Persona Sintética',{plain:true});let s=await state(applicationId);assert.equal(s.step,'JOB');assert.equal(s.consent,false);assert.equal((await query('SELECT count(*)::int AS n FROM public.\"Worker\"')).rows[0].n,0);await advance({type:'interactive',interactive:{list_reply:{id:'intake:'+s.nonce+':0'}}});await advance('person@example.invalid',{plain:true});s=await state(applicationId);assert.equal(s.step,'CONFIRM');assert.equal(s.consent,false);checks.push('real-PG-signed-plain-name-email-current-sealed-outbox-time-fence-no-person-or-grant');const confirmId=await advance({type:'interactive',interactive:{list_reply:{id:'intake:'+s.nonce+':0'}}});s=await state(applicationId);assert.equal(s.status,'WAITING_RESPONSIBLE');assert.equal(s.consent,true);const actual=(await query(`SELECT payload FROM public.\"WebhookEvent\" WHERE id=$1`,[applicationId])).rows[0].payload;for(const key of ['encryptedPayload','encryptedProof','payloadDigest'])assert.equal(actual[key],sourceBytes.get(applicationId)[key]);assert.doesNotMatch(JSON.stringify(actual),/Persona Sintética|person@example|15550001001/);checks.push('actual-signed-callback-processor-context-consent-encrypted-durable-original-source');\n const waitingPolicy=(await query(`SELECT metadata FROM public.\"WhatsAppConnection\" WHERE id='channel-a'`)).rows[0].metadata.employeeIntakePolicy,waitingSource=structuredClone(actual),waitingState=structuredClone(s),oldRouting=await push('HOLA',{sender:'15550001009'});\n await query(`INSERT INTO public.\"Project\"(id,\"organizationId\",name,status,metadata) VALUES('project-d','org-a','Synthetic additive destination','ACTIVE','{}')`);\n",
              "previousText": " const blocked=await push('HOLA');await processor.process(blocked);assert.equal(sends,0);assert.equal((await query('SELECT count(*)::int AS n FROM public.\"Worker\"')).rows[0].n,0);checks.push('default-off-signed-source-no-send-no-person');await configure(true);\n let current=null,applicationId;const advance=async(message,{plain=false,sender='15550001001'}={})=>{const prior=applicationId?await state(applicationId):null,timestamp=Math.max(Math.floor(Date.now()/1000),prior?.lastMessageTimestamp+(plain?1:0)||0,plain?Math.floor(Date.parse(current.completedAt)/1000)+1:0);const id=await push(message,{sender,reply:plain?null:current?.messageId||null,timestamp});const outcome=await processor.process(id);current=(await query(`SELECT outcome FROM public.\"WebhookEvent\" WHERE id=$1`,[customerOutboundId(id)])).rows[0]?.outcome;assert.equal(outcome.businessApplied,false);assert.equal(current.state,'SENT');return id;};\n applicationId=await advance('HOLA');await advance('Persona Sintética',{plain:true});let s=await state(applicationId);assert.equal(s.step,'JOB');assert.equal(s.consent,false);assert.equal((await query('SELECT count(*)::int AS n FROM public.\"Worker\"')).rows[0].n,0);await advance({type:'interactive',interactive:{list_reply:{id:'intake:'+s.nonce+':0'}}});await advance('person@example.invalid',{plain:true});s=await state(applicationId);assert.equal(s.step,'CONFIRM');assert.equal(s.consent,false);checks.push('real-PG-signed-plain-name-email-current-sealed-outbox-time-fence-no-person-or-grant');const confirmId=await advance({type:'interactive',interactive:{list_reply:{id:'intake:'+s.nonce+':0'}}});s=await state(applicationId);assert.equal(s.status,'WAITING_RESPONSIBLE');assert.equal(s.consent,true);const actual=(await query(`SELECT payload FROM public.\"WebhookEvent\" WHERE id=$1`,[applicationId])).rows[0].payload;for(const key of ['encryptedPayload','encryptedProof','payloadDigest'])assert.equal(actual[key],sourceBytes.get(applicationId)[key]);assert.doesNotMatch(JSON.stringify(actual),/Persona Sintética|person@example|15550001001/);checks.push('actual-signed-callback-processor-context-consent-encrypted-durable-original-source');\n const waitingPolicy=(await query(`SELECT metadata FROM public.\"WhatsAppConnection\" WHERE id='channel-a'`)).rows[0].metadata.employeeIntakePolicy,waitingSource=structuredClone(actual),waitingState=structuredClone(s),oldRouting=await push('HOLA',{sender:'15550001009'});\n await query(`INSERT INTO public.\"Project\"(id,\"organizationId\",name,status,metadata) VALUES('project-d','org-a','Synthetic additive destination','ACTIVE','{}')`);\n"
            },
            {
              "currentOffsetCharacters": 29167,
              "currentText": " await configure(true);const freshPolicy=(await query(`SELECT metadata FROM public.\"WhatsAppConnection\" WHERE id='channel-a'`)).rows[0].metadata.employeeIntakePolicy;const off=command('CONFIGURE_EMPLOYEE_INTAKE',{expectedRevision:freshPolicy.revision,enabled:false,confirmed:true});loseReceiptCommit=true;await assert.rejects(store.save(owner,off),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});const recovered=await store.status(owner,{...context,operationId:off.operationId});assert.equal(recovered.state,'RECORDED');assert.equal(recovered.action,'CONFIGURE_EMPLOYEE_INTAKE');checks.push('actual-PG-committed-policy-ACK-loss-recovery-without-post-repeat');\n // Each destructive transition below uses the canonical company command in\n // this disposable schema. A fresh signed six-message application supplies\n // real consented pending state; no old consent is migrated to a new policy.\n const consented=async sender=>{await configure(true);current=null;applicationId=null;applicationId=await advance('HOLA',{sender});await requestAccess(sender);await advance('Persona Sintética',{plain:true,sender});let value=await state(applicationId);await advance({type:'interactive',interactive:{list_reply:{id:'intake:'+value.nonce+':0'}}},{sender});await advance('person@example.invalid',{plain:true,sender});value=await state(applicationId);await advance({type:'interactive',interactive:{list_reply:{id:'intake:'+value.nonce+':0'}}},{sender});value=await state(applicationId);assert.equal(value.status,'WAITING_RESPONSIBLE');assert.equal(value.consent,true);return {id:applicationId,state:value,payload:(await query(`SELECT payload FROM public.\"WebhookEvent\" WHERE id=$1`,[applicationId])).rows[0].payload,policy:(await query(`SELECT metadata FROM public.\"WhatsAppConnection\" WHERE id='channel-a'`)).rows[0].metadata.employeeIntakePolicy};};\n const denyPending=async pending=>{const beforeWorkers=(await query('SELECT count(*)::int AS n FROM public.\"Worker\"')).rows[0].n;await assert.rejects(store.save(owner,command('ADMIT_EMPLOYEE_INTAKE',{applicationId:pending.id,expectedRevision:pending.state.revision,job:'WORKER',permissions:{attendance:false,report:true},confirmed:true})),{code:'EMPLOYEE_INTAKE_REVOKED'});assert.equal((await query('SELECT count(*)::int AS n FROM public.\"Worker\"')).rows[0].n,beforeWorkers);assert.deepEqual(await state(pending.id),pending.state);assert.deepEqual((await query(`SELECT payload FROM public.\"WebhookEvent\" WHERE id=$1`,[pending.id])).rows[0].payload,pending.payload);assert.deepEqual((await query(`SELECT metadata FROM public.\"WhatsAppConnection\" WHERE id='channel-a'`)).rows[0].metadata.employeeIntakePolicy,pending.policy);};\n // Existing-profile decisions use new signed applications and the canonical\n",
              "previousText": " await configure(true);const freshPolicy=(await query(`SELECT metadata FROM public.\"WhatsAppConnection\" WHERE id='channel-a'`)).rows[0].metadata.employeeIntakePolicy;const off=command('CONFIGURE_EMPLOYEE_INTAKE',{expectedRevision:freshPolicy.revision,enabled:false,confirmed:true});loseReceiptCommit=true;await assert.rejects(store.save(owner,off),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});const recovered=await store.status(owner,{...context,operationId:off.operationId});assert.equal(recovered.state,'RECORDED');assert.equal(recovered.action,'CONFIGURE_EMPLOYEE_INTAKE');checks.push('actual-PG-committed-policy-ACK-loss-recovery-without-post-repeat');\n // Each destructive transition below uses the canonical company command in\n // this disposable schema. A fresh signed five-message application supplies\n // real consented pending state; no old consent is migrated to a new policy.\n const consented=async sender=>{await configure(true);current=null;applicationId=null;applicationId=await advance('HOLA',{sender});await advance('Persona Sintética',{plain:true,sender});let value=await state(applicationId);await advance({type:'interactive',interactive:{list_reply:{id:'intake:'+value.nonce+':0'}}},{sender});await advance('person@example.invalid',{plain:true,sender});value=await state(applicationId);await advance({type:'interactive',interactive:{list_reply:{id:'intake:'+value.nonce+':0'}}},{sender});value=await state(applicationId);assert.equal(value.status,'WAITING_RESPONSIBLE');assert.equal(value.consent,true);return {id:applicationId,state:value,payload:(await query(`SELECT payload FROM public.\"WebhookEvent\" WHERE id=$1`,[applicationId])).rows[0].payload,policy:(await query(`SELECT metadata FROM public.\"WhatsAppConnection\" WHERE id='channel-a'`)).rows[0].metadata.employeeIntakePolicy};};\n const denyPending=async pending=>{const beforeWorkers=(await query('SELECT count(*)::int AS n FROM public.\"Worker\"')).rows[0].n;await assert.rejects(store.save(owner,command('ADMIT_EMPLOYEE_INTAKE',{applicationId:pending.id,expectedRevision:pending.state.revision,job:'WORKER',permissions:{attendance:false,report:true},confirmed:true})),{code:'EMPLOYEE_INTAKE_REVOKED'});assert.equal((await query('SELECT count(*)::int AS n FROM public.\"Worker\"')).rows[0].n,beforeWorkers);assert.deepEqual(await state(pending.id),pending.state);assert.deepEqual((await query(`SELECT payload FROM public.\"WebhookEvent\" WHERE id=$1`,[pending.id])).rows[0].payload,pending.payload);assert.deepEqual((await query(`SELECT metadata FROM public.\"WhatsAppConnection\" WHERE id='channel-a'`)).rows[0].metadata.employeeIntakePolicy,pending.policy);};\n // Existing-profile decisions use new signed applications and the canonical\n"
            }
          ]
        }
      },
      {
        "producer": "scripts/verify-meta-field-bridge-postgres.mjs",
        "previousSha256": "1580fcf08d81f0778cb4240215060d51f321671eba2d1b2d72aac7f800d3ee63",
        "currentSha256": "79b904814356166aac925e6d38d9b4a16a1f7009432b963b48d7c5a3f71aa62d",
        "contractPointers": [],
        "sourceHistory": {
          "previousBytes": 126680,
          "currentBytes": 136439,
          "inverseHunks": [
            {
              "currentOffsetCharacters": 968,
              "currentText": "import {createMetaFieldBridge,readMetaFieldTaskCatalog,readMetaFieldEvidenceCatalog} from '../src/lib/meta-field-bridge.mjs';\n\nimport {readMetaConsumptionEvidenceCatalog} from '../src/lib/meta-consumption-evidence-catalog.mjs';\nimport {createMetaCustomerProcessor} from '../src/lib/meta-customer-processing.mjs';\nimport {decryptCustomerSecret,encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';\n",
              "previousText": "import {createMetaFieldBridge,readMetaFieldTaskCatalog,readMetaFieldEvidenceCatalog} from '../src/lib/meta-field-bridge.mjs';\n\nimport {createMetaCustomerProcessor} from '../src/lib/meta-customer-processing.mjs';\nimport {decryptCustomerSecret,encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';\n"
            },
            {
              "currentOffsetCharacters": 42605,
              "currentText": "  if(kind==='video'){assert.match(uploadedMedia.result.reply.body,/cuatro cuadros sin audio/);assert.equal(storedEvidence.processing.result.sampling.frameCount,4);}\n }\n await selectLegacyMedia(false);const savedOnly=await execute({type:'video',video:{id:'150000302',mime_type:'video/mp4',caption:'Controlled saved-only video'}}),savedOnlyEvidence=(await operations.read(owner,ownerContext)).evidence.find(e=>e.caption==='Controlled saved-only video');assert.equal(savedOnlyEvidence.processing.status,'QUEUED');assert.equal(videoAnalyses,1);assert.match(savedOnly.result.reply.body,/Se guardó sin análisis asistido/);assert.deepEqual((await media.download(owner,{...ownerContext,evidenceId:savedOnlyEvidence.id})).bytes,video);\n await selectLegacyMedia();rejectVideoAnalysis=true;const failedVideo=await execute({type:'video',video:{id:'150000303',mime_type:'video/mp4',caption:'Controlled failed video analysis'}});rejectVideoAnalysis=false;const failedEvidence=(await operations.read(owner,ownerContext)).evidence.find(e=>e.caption==='Controlled failed video analysis');assert.equal(failedEvidence.status,'PENDING');assert.equal(failedEvidence.processing.status,'FAILED_RETRYABLE');assert.deepEqual(failedEvidence.processing.analysisConsent,fieldMediaAnalysisConsent(true));assert.match(failedVideo.result.reply.body,/otro intento desde la web/);assert.equal(videoAnalyses,2);assert.deepEqual((await media.download(owner,{...ownerContext,evidenceId:failedEvidence.id})).bytes,video);const failedPuts=puts;assert.deepEqual(await bridge.execute(failedVideo.ctx),failedVideo.result);assert.equal(puts,failedPuts);assert.equal(videoAnalyses,2);assert.deepEqual((await workspace.read(owner,ownerContext)).tasks[0],unchangedTask);\n // Current reference flow uses two separate video notices and an explicit\n",
              "previousText": "  if(kind==='video'){assert.match(uploadedMedia.result.reply.body,/cuatro cuadros sin audio/);assert.equal(storedEvidence.processing.result.sampling.frameCount,4);}\n }\n await selectLegacyMedia(false);const savedOnly=await execute({type:'video',video:{id:'150000302',mime_type:'video/mp4',caption:'Controlled saved-only video'}}),savedOnlyEvidence=(await operations.read(owner,ownerContext)).evidence.find(e=>e.caption==='Controlled saved-only video');assert.equal(savedOnlyEvidence.processing.status,'QUEUED');assert.equal(videoAnalyses,1);assert.match(savedOnly.result.reply.body,/No se envió a OpenAI/);assert.deepEqual((await media.download(owner,{...ownerContext,evidenceId:savedOnlyEvidence.id})).bytes,video);\n await selectLegacyMedia();rejectVideoAnalysis=true;const failedVideo=await execute({type:'video',video:{id:'150000303',mime_type:'video/mp4',caption:'Controlled failed video analysis'}});rejectVideoAnalysis=false;const failedEvidence=(await operations.read(owner,ownerContext)).evidence.find(e=>e.caption==='Controlled failed video analysis');assert.equal(failedEvidence.status,'PENDING');assert.equal(failedEvidence.processing.status,'FAILED_RETRYABLE');assert.deepEqual(failedEvidence.processing.analysisConsent,fieldMediaAnalysisConsent(true));assert.match(failedVideo.result.reply.body,/otro intento desde la web/);assert.equal(videoAnalyses,2);assert.deepEqual((await media.download(owner,{...ownerContext,evidenceId:failedEvidence.id})).bytes,video);const failedPuts=puts;assert.deepEqual(await bridge.execute(failedVideo.ctx),failedVideo.result);assert.equal(puts,failedPuts);assert.equal(videoAnalyses,2);assert.deepEqual((await workspace.read(owner,ownerContext)).tasks[0],unchangedTask);\n // Current reference flow uses two separate video notices and an explicit\n"
            },
            {
              "currentOffsetCharacters": 125341,
              "currentText": " checks.push('progress-evidence-wait-real-SQL-expiry-after-proposal-INSERT-rolls-back-business-Task-Incident-Proposal-Audit-and-retains-exact-encrypted-confirmation-for-one-expiry-replay');\n\n\n // New consumption-catalog SQL coverage stays in this existing disposable DB.\n // The bridge supplies these principals; direct helper calls below exercise the\n // same predicates against PostgreSQL rather than a mocked query dispatcher.\n const consumptionTaskIds=['consumption-scope-task','consumption-lock-task'];\n for(const id of consumptionTaskIds)await pool.query(`INSERT INTO public.\"Task\"(id,\"projectId\",title,status,progress,metadata) VALUES($1,'project-a',$1,'BACKLOG',0,'{}')`,[id]);\n const consumptionScope={organizationId:'org-a',projectId:'project-a',workerId:'worker-a',actorId:'person',tasks:consumptionTaskIds.map(id=>({id})),sectors:[{id:'sector-main'}]},consumptionState={version:1,purpose:'CONSUMPTION',step:'CONSUMPTION_MATERIAL',taskId:consumptionTaskIds[0],sectorId:'sector-main'};\n const consumptionMedia={kind:'image',contentType:'image/png',bytes:png.length,sha256:createHash('sha256').update(png).digest('hex'),pathname:'obrasaas/field/v1/'+'c'.repeat(64)+'/evidence.png'};\n async function insertConsumptionEvidence(id,{taskId=consumptionTaskIds[0],workerId='worker-a',recordedBy='person',sectorId='sector-main',projectId='project-a',review=null,kind='image'}={}){\n  const field={version:1,kind:'EVIDENCE',workerId,recordedBy,taskId,sectorId,media:{...consumptionMedia,kind,contentType:kind==='audio'?'audio/ogg':kind==='video'?'video/mp4':'image/png'},review,capturedAt:'2020-01-01T00:00:00.000Z',processing:kind==='audio'?{status:'TRANSCRIBED_UNREVIEWED',analysisConsent:fieldMediaAnalysisConsent(true),result:{success:true,status:'TRANSCRIBED_UNREVIEWED',text:'Private persisted synthetic consumption transcript'}}:{status:'NOT_REQUESTED'}};\n  await pool.query(`INSERT INTO public.\"Incident\"(id,\"projectId\",title,description,metadata,\"createdAt\",\"updatedAt\") VALUES($1,$2,$1,'Synthetic consumption catalog original',$3::jsonb,timestamp '2020-01-01 00:00:00.000001',timestamp '2020-01-02 00:00:00.000001')`,[id,projectId,JSON.stringify({fieldOperations:field})]);\n }\n const ownConsumptionIds=Array.from({length:13},(_,i)=>'consumption-own-'+String(i).padStart(2,'0'));\n for(const [index,id] of ownConsumptionIds.entries())await insertConsumptionEvidence(id,{kind:index===0?'audio':'image',review:index===1?{decision:'APPROVE',reason:'Synthetic prior human review',recordedAt:'2020-01-02T00:00:00Z'}:null});\n for(let i=0;i<105;i++)await insertConsumptionEvidence('consumption-other-worker-'+String(i).padStart(3,'0'),{workerId:'worker-other'});\n for(const [id,options] of [['consumption-other-author',{recordedBy:'owner'}],['consumption-other-sector',{sectorId:'sector-other'}],['consumption-other-task',{taskId:'task-a'}],['consumption-other-tenant',{projectId:'project-b'}],['consumption-rejected',{review:{decision:'REJECT'}}],['consumption-video',{kind:'video'}],['consumption-unassigned',{taskId:null}]])await insertConsumptionEvidence(id,options);\n const consumptionChoice=(state,value)=>({state:{...state,step:'CONSUMPTION_EVIDENCE',nonce:'e'.repeat(20),choices:[{value}]},message:{type:'interactive',interactive:{type:'list_reply',list_reply:{id:'obra:'+'e'.repeat(20)+':0'}}}});\n const readConsumptionCatalog=(state=consumptionState,message=null,client=pool)=>readMetaConsumptionEvidenceCatalog(client,{...consumptionScope,state,message});\n const consumptionFirst=await readConsumptionCatalog();assert.equal(consumptionFirst.entries.length,6);assert.equal(consumptionFirst.page.hasPrevious,false);assert.equal(consumptionFirst.page.hasNext,true);\n const consumptionNext=consumptionChoice({...consumptionState,consumptionEvidencePage:consumptionFirst.page},'NEXT_CONSUMPTION_EVIDENCE'),consumptionSecond=await readConsumptionCatalog(consumptionNext.state,consumptionNext.message);\n const consumptionLastChoice=consumptionChoice({...consumptionState,consumptionEvidencePage:consumptionSecond.page},'NEXT_CONSUMPTION_EVIDENCE'),consumptionLast=await readConsumptionCatalog(consumptionLastChoice.state,consumptionLastChoice.message);\n assert.deepEqual([consumptionFirst.entries.length,consumptionSecond.entries.length,consumptionLast.entries.length],[6,6,1]);assert.equal(consumptionLast.page.hasNext,false);\n const allConsumptionEntries=[...consumptionFirst.entries,...consumptionSecond.entries,...consumptionLast.entries];assert.deepEqual(allConsumptionEntries.map(row=>row.id),ownConsumptionIds.toReversed());assert.equal(new Set(allConsumptionEntries.map(row=>row.id)).size,13);\n assert.ok(allConsumptionEntries.some(row=>row.status==='PENDING'));assert.ok(allConsumptionEntries.some(row=>row.status==='APPROVED'));assert.doesNotMatch(JSON.stringify(allConsumptionEntries),/pathname|processing|Private persisted|https?:/);\n const consumptionBackChoice=consumptionChoice({...consumptionState,consumptionEvidencePage:consumptionLast.page},'PREVIOUS_CONSUMPTION_EVIDENCE');assert.deepEqual(await readConsumptionCatalog(consumptionBackChoice.state,consumptionBackChoice.message),consumptionSecond);\n const selectedConsumptionAudio=consumptionChoice({...consumptionState,consumptionEvidencePage:consumptionLast.page},ownConsumptionIds[0]),selectedConsumptionAudioResult=await readConsumptionCatalog(selectedConsumptionAudio.state,selectedConsumptionAudio.message);assert.equal(selectedConsumptionAudioResult.evidence.find(row=>row.id===ownConsumptionIds[0]).processing.result.text,'Private persisted synthetic consumption transcript');assert.ok(selectedConsumptionAudioResult.entries.every(row=>!Object.hasOwn(row,'processing')));\n const staleConsumptionQueries=[],staleConsumptionAudio=await readConsumptionCatalog(selectedConsumptionAudio.state,{type:'interactive',interactive:{type:'list_reply',list_reply:{id:'obra:'+'f'.repeat(20)+':0'}}},{query:(sql,args)=>{staleConsumptionQueries.push(sql);return pool.query(sql,args);}});assert.ok(staleConsumptionQueries.every(sql=>!sql.includes('FOR SHARE OF i')));assert.ok(staleConsumptionAudio.evidence.every(row=>!Object.hasOwn(row,'processing')));\n const unassigned=await readConsumptionCatalog({...consumptionState,taskId:null});assert.deepEqual(unassigned.entries.map(row=>row.id),['consumption-unassigned']);\n const wrongConsumptionOrganization=await readMetaConsumptionEvidenceCatalog(pool,{...consumptionScope,organizationId:'org-b',state:consumptionState});assert.deepEqual(wrongConsumptionOrganization.entries,[]);assert.deepEqual(wrongConsumptionOrganization.evidence,[]);\n await assert.rejects(readConsumptionCatalog({...consumptionNext.state,consumptionEvidencePage:{...consumptionFirst.page,contextDigest:'f'.repeat(64)}}),{code:'FIELD_EVIDENCE_UNAVAILABLE'});\n await pool.query(`UPDATE public.\"Incident\" SET metadata=jsonb_set(metadata,'{fieldOperations,recordedBy}','\"owner\"') WHERE id=$1`,[consumptionFirst.page.first.id]);\n try{await assert.rejects(readConsumptionCatalog(consumptionNext.state,consumptionNext.message),{code:'FIELD_EVIDENCE_UNAVAILABLE'});}finally{await pool.query(`UPDATE public.\"Incident\" SET metadata=jsonb_set(metadata,'{fieldOperations,recordedBy}','\"person\"') WHERE id=$1`,[consumptionFirst.page.first.id]);}\n const missingRetained=await readConsumptionCatalog({...consumptionState,step:'CONFIRM',evidenceIds:['consumption-rejected','consumption-other-author','consumption-other-tenant']});assert.ok(!missingRetained.evidence.some(row=>['consumption-rejected','consumption-other-author','consumption-other-tenant'].includes(row.id)));\n checks.push('consumption-evidence-real-PG-own13-beyond100-foreign-keyset-six-row-ties-null-task-minimal-DTO-and-stale-anchor-scope');\n\n for(let i=0;i<30;i++)await insertConsumptionEvidence('consumption-lock-'+String(i).padStart(2,'0'),{taskId:consumptionTaskIds[1]});\n const retainedConsumptionIds=Array.from({length:10},(_,i)=>'consumption-lock-'+String(i).padStart(2,'0')).toReversed(),retainedSql=[],retainedClient=await pool.connect(),retainedContender=await pool.connect();\n try{\n  await retainedClient.query('BEGIN');\n  const observedClient={query:async(sql,args)=>{retainedSql.push({sql,args:structuredClone(args)});return retainedClient.query(sql,args);}},retainedPage=await readConsumptionCatalog({...consumptionState,taskId:consumptionTaskIds[1],step:'CONFIRM',evidenceIds:retainedConsumptionIds},null,observedClient);\n  assert.equal(retainedPage.entries.length,6);assert.ok(retainedConsumptionIds.every(id=>!retainedPage.entries.some(row=>row.id===id)&&retainedPage.evidence.some(row=>row.id===id)));\n  const retainedQueries=retainedSql.filter(row=>row.sql.includes('FOR SHARE OF i'));assert.equal(retainedQueries.length,1);assert.match(retainedQueries[0].sql,/i\\.id=ANY\\(\\$7::text\\[\\]\\) ORDER BY i\\.id FOR SHARE OF i$/);assert.deepEqual(retainedQueries[0].args,['project-a',consumptionTaskIds[1],'worker-a','person','org-a','sector-main',retainedConsumptionIds.toSorted()]);\n  await retainedContender.query('BEGIN');await retainedContender.query(`SET LOCAL lock_timeout='250ms'`);\n  await assert.rejects(retainedContender.query(`UPDATE public.\"Incident\" SET title=title WHERE id=$1`,[retainedConsumptionIds[0]]),{code:'55P03'});await retainedContender.query('ROLLBACK');\n  await retainedClient.query('COMMIT');await retainedContender.query('BEGIN');await retainedContender.query(`SET LOCAL lock_timeout='250ms'`);assert.equal((await retainedContender.query(`UPDATE public.\"Incident\" SET title=title WHERE id=$1`,[retainedConsumptionIds[0]])).rowCount,1);await retainedContender.query('ROLLBACK');\n }finally{await retainedClient.query('ROLLBACK');await retainedContender.query('ROLLBACK');retainedClient.release();retainedContender.release();}\n checks.push('consumption-retained-ten-outside-page-use-one-scoped-sorted-ANY-share-lock-that-blocks-real-UPDATE-until-owner-commit');\n\n  report={status:'PASS',environment:'disposable-local-postgresql-actual-HMAC-and-real-canonical-bridge',checks,provider:'controlled-synthetic-media-only',blob:'controlled-private-byte-store',outbound:'controlled-no-send-result-only',productionDataWritten:false,realMetaRequests:0,physicalAttendanceAccepted:false,realHumanIdentityAccepted:false};\n}finally{try{await closeDisposablePool(pool);cleanup.poolClosed=true;if(created){assert.equal((await admin.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1',[database])).rows[0].n,0);cleanup.ownConnectionsClosed=true;await admin.query(`DROP DATABASE \"${database}\"`);assert.equal((await admin.query('SELECT count(*)::int AS n FROM pg_database WHERE datname=$1',[database])).rows[0].n,0);cleanup.databaseRemoved=true;}}finally{await admin.end();cleanup.adminClosed=true;}}\n",
              "previousText": " checks.push('progress-evidence-wait-real-SQL-expiry-after-proposal-INSERT-rolls-back-business-Task-Incident-Proposal-Audit-and-retains-exact-encrypted-confirmation-for-one-expiry-replay');\n\n  report={status:'PASS',environment:'disposable-local-postgresql-actual-HMAC-and-real-canonical-bridge',checks,provider:'controlled-synthetic-media-only',blob:'controlled-private-byte-store',outbound:'controlled-no-send-result-only',productionDataWritten:false,realMetaRequests:0,physicalAttendanceAccepted:false,realHumanIdentityAccepted:false};\n}finally{try{await closeDisposablePool(pool);cleanup.poolClosed=true;if(created){assert.equal((await admin.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1',[database])).rows[0].n,0);cleanup.ownConnectionsClosed=true;await admin.query(`DROP DATABASE \"${database}\"`);assert.equal((await admin.query('SELECT count(*)::int AS n FROM pg_database WHERE datname=$1',[database])).rows[0].n,0);cleanup.databaseRemoved=true;}}finally{await admin.end();cleanup.adminClosed=true;}}\n"
            }
          ]
        }
      },
      {
        "producer": "scripts/verify-material-inventory-postgres.mjs",
        "previousSha256": "56c2c4751825349b126d26bc48fcce0557f11b779f94b3fad45985f34bbc409b",
        "currentSha256": "c046f5bae2f922bcf83b3f2dffc53ad36f10a9dcc1e57bbd73923176d1bf8093",
        "contractPointers": [],
        "sourceHistory": {
          "previousBytes": 61857,
          "currentBytes": 73817,
          "inverseHunks": [
            {
              "currentOffsetCharacters": 501,
              "currentText": "import {createCanonicalParticipantKycFixture,canonicalParticipantKycSourceFiles} from './fixtures/canonical-participant-kyc.mjs';\nimport {createFieldOperations} from '../src/lib/field-operations-store.mjs';\nimport {fieldMediaAnalysisConsent} from '../src/lib/field-media-privacy.mjs';\nimport {createSitePurchases} from '../src/lib/site-purchase-store.mjs';\nimport {createSiteRegister} from '../src/lib/site-register-store.mjs';\n",
              "previousText": "import {createCanonicalParticipantKycFixture,canonicalParticipantKycSourceFiles} from './fixtures/canonical-participant-kyc.mjs';\nimport {createFieldOperations} from '../src/lib/field-operations-store.mjs';\nimport {createSitePurchases} from '../src/lib/site-purchase-store.mjs';\nimport {createSiteRegister} from '../src/lib/site-register-store.mjs';\n"
            },
            {
              "currentOffsetCharacters": 21202,
              "currentText": " await pool.query(`INSERT INTO \"WhatsAppConnection\"(id,\"projectId\",enabled,\"connectionStatus\",\"phoneNumberId\",\"whatsappBusinessId\",\"encryptedAccessToken\",\"displayPhoneNumber\",metadata) VALUES($1,'p-a',true,'CONNECTED',$2,$3,$4,'+5491100009999',$5::jsonb)`,[channelId,phoneNumberId,wabaId,encryptCustomerSecret('synthetic-inventory-token-no-real-access',{organizationId:'company-a',projectId:'p-a',purpose:'access-token',resourceId:phoneNumberId},environment),JSON.stringify(channelMetadata)]);\n const channel=createWorkerChannelStore({workspace}),bridge=createMetaFieldBridge({connect,environment}),inbox=createMetaCustomerInbox({connect,environment}),callback=createMetaCustomerCallbackHandlers({inbox,environment}),dispatched=new Map(),processor=createMetaCustomerProcessor({connect,environment,dispatch:async ctx=>{const result=await bridge.execute(ctx);dispatched.set(ctx.eventId,result);return result;},outbound:{send:async()=>({replySent:false,state:'SYNTHETIC_NOT_SENT'})}});\n async function push(message,{signatureValid=true,processorOverride=processor}={}){const value={id:'wamid.'+randomUUID().replaceAll('-',''),from:'5491100002222',timestamp:String(Math.floor(Date.now()/1000)),...(typeof message==='string'?{type:'text',text:{body:message}}:message)},payload={object:'whatsapp_business_account',entry:[{id:wabaId,changes:[{field:'messages',value:{metadata:{phone_number_id:phoneNumberId},messages:[value]}}]}]},bytes=Buffer.from(JSON.stringify(payload)),signature='sha256='+createHmac('sha256',environment.META_APP_SECRET).update(bytes).digest('hex'),response=await callback.POST(new Request('https://obrasaas.com/api/meta/customer-callback',{method:'POST',headers:{'Content-Type':'application/json','x-hub-signature-256':signatureValid?signature:'sha256='+'0'.repeat(64)},body:bytes}));if(!signatureValid){assert.equal(response.status,403);return null;}assert.equal(response.status,200);const eventId='customer_webhook_'+splitMetaCustomerEvents(payload)[0].externalId,job=await processorOverride.recover({eventIds:[eventId]});return {eventId,job,result:dispatched.get(eventId)};}\n async function choose(plan,title){const row=plan.result.reply.sections.flatMap(s=>s.rows).find(r=>r.title===title);assert.ok(row,'Missing choice '+title);return push({type:'interactive',interactive:{type:'list_reply',list_reply:{id:row.id,title:row.title}}});}\n const personal=(await channel.read(worker,workerContext)).records.find(r=>r.workerId==='w-worker'),challenge=await channel.command(worker,{...workerContext,operationId:randomUUID(),action:'REQUEST_CHALLENGE',payload:{workerId:personal.workerId,revision:personal.revision}}),bound=await push(challenge.code);assert.equal(bound.result.kind,'CHANNEL_BOUND');\n",
              "previousText": " await pool.query(`INSERT INTO \"WhatsAppConnection\"(id,\"projectId\",enabled,\"connectionStatus\",\"phoneNumberId\",\"whatsappBusinessId\",\"encryptedAccessToken\",\"displayPhoneNumber\",metadata) VALUES($1,'p-a',true,'CONNECTED',$2,$3,$4,'+5491100009999',$5::jsonb)`,[channelId,phoneNumberId,wabaId,encryptCustomerSecret('synthetic-inventory-token-no-real-access',{organizationId:'company-a',projectId:'p-a',purpose:'access-token',resourceId:phoneNumberId},environment),JSON.stringify(channelMetadata)]);\n const channel=createWorkerChannelStore({workspace}),bridge=createMetaFieldBridge({connect,environment}),inbox=createMetaCustomerInbox({connect,environment}),callback=createMetaCustomerCallbackHandlers({inbox,environment}),dispatched=new Map(),processor=createMetaCustomerProcessor({connect,environment,dispatch:async ctx=>{const result=await bridge.execute(ctx);dispatched.set(ctx.eventId,result);return result;},outbound:{send:async()=>({replySent:false,state:'SYNTHETIC_NOT_SENT'})}});\n async function push(message,{signatureValid=true}={}){const value={id:'wamid.'+randomUUID().replaceAll('-',''),from:'5491100002222',timestamp:String(Math.floor(Date.now()/1000)),...(typeof message==='string'?{type:'text',text:{body:message}}:message)},payload={object:'whatsapp_business_account',entry:[{id:wabaId,changes:[{field:'messages',value:{metadata:{phone_number_id:phoneNumberId},messages:[value]}}]}]},bytes=Buffer.from(JSON.stringify(payload)),signature='sha256='+createHmac('sha256',environment.META_APP_SECRET).update(bytes).digest('hex'),response=await callback.POST(new Request('https://obrasaas.com/api/meta/customer-callback',{method:'POST',headers:{'Content-Type':'application/json','x-hub-signature-256':signatureValid?signature:'sha256='+'0'.repeat(64)},body:bytes}));if(!signatureValid){assert.equal(response.status,403);return null;}assert.equal(response.status,200);const eventId='customer_webhook_'+splitMetaCustomerEvents(payload)[0].externalId,job=await processor.recover({eventIds:[eventId]});return {eventId,job,result:dispatched.get(eventId)};}\n async function choose(plan,title){const row=plan.result.reply.sections.flatMap(s=>s.rows).find(r=>r.title===title);assert.ok(row,'Missing choice '+title);return push({type:'interactive',interactive:{type:'list_reply',list_reply:{id:row.id,title:row.title}}});}\n const personal=(await channel.read(worker,workerContext)).records.find(r=>r.workerId==='w-worker'),challenge=await channel.command(worker,{...workerContext,operationId:randomUUID(),action:'REQUEST_CHALLENGE',payload:{workerId:personal.workerId,revision:personal.revision}}),bound=await push(challenge.code);assert.equal(bound.result.kind,'CHANNEL_BOUND');\n"
            },
            {
              "currentOffsetCharacters": 60565,
              "currentText": " const homeDecisions={projection:'decisions',sqlQueriesPerRead:2,authorizedReads:homeReads,progressPending:2,materialPendingPerKind:202,foreignProgressPending:1,excludedExpiredClosedProviderAndVersion:true,canonicalReadOnly:true,businessStateUnchanged:true,providerCalls:0};\n checks.push('native-home-decisions-read-uses-two-canonical-same-snapshot-aggregates-with-current-progress-material-totals-tenant-role-scope-denials-and-no-business-write');\n\n // Reuse the signed inbox, canonical worker binding, existing maker/checker and\n // stock ledger. Originals below model already-persisted private media only.\n // Reading or proposing them must not download, transcribe or upload anything.\n const evidenceContext=async actor=>({projectId:'p-a',scope:(await workspace.list(actor)).scope}),evidenceRead=async()=>field.read(owner,await evidenceContext(owner)),evidenceBusiness=async()=>({consumptions:(await counts()).consumptions,movements:(await counts()).movements,balance:(await evidenceRead()).inventory.materials.find(row=>row.id===materialId).balance,task:(await pool.query(`SELECT row_to_json(t) AS row FROM public.\"Task\" t WHERE id='task-a'`)).rows[0].row});\n const evidenceBytes=Buffer.from('synthetic previously saved private consumption original'),evidenceHash=createHash('sha256').update(evidenceBytes).digest('hex'),evidenceIds=['consumption-native-photo','consumption-native-audio'],evidenceOriginals=new Map();\n for(const [id,kind,title] of [[evidenceIds[0],'image','Foto consumo nativo'],[evidenceIds[1],'audio','Audio consumo nativo']]){\n  const details={version:1,kind:'EVIDENCE',recordedBy:'worker',workerId:'w-worker',taskId:null,sectorId:'sector-a',capturedAt:'2020-01-01T00:00:00.000Z',media:{kind,contentType:kind==='audio'?'audio/ogg':'image/png',bytes:evidenceBytes.length,sha256:evidenceHash,pathname:'obrasaas/field/v1/'+'d'.repeat(64)+'/evidence.'+(kind==='audio'?'ogg':'png')},review:null,processing:kind==='audio'?{status:'TRANSCRIBED_UNREVIEWED',analysisConsent:fieldMediaAnalysisConsent(true),result:{success:true,status:'TRANSCRIBED_UNREVIEWED',text:'Usamos 0,001 bolsas de Cemento catálogo sintético para la mezcla.'}}:{status:'NOT_REQUESTED'}};\n  evidenceOriginals.set(id,{fieldOperations:details});\n  await pool.query(`INSERT INTO public.\"Incident\"(id,\"projectId\",title,description,metadata,\"createdAt\",\"updatedAt\") VALUES($1,'p-a',$2,'Previously saved synthetic private original',$3::jsonb,timestamp '2020-01-01',timestamp '2020-01-02 00:00:00.000001')`,[id,title,JSON.stringify({fieldOperations:details})]);\n }\n let evidenceProviderCalls=0;const forbidEvidenceIo=async()=>{evidenceProviderCalls++;throw Error('SYNTHETIC_UNEXPECTED_CONSUMPTION_MEDIA_IO');},evidenceBridge=createMetaFieldBridge({connect,environment,provider:{downloadMedia:forbidEvidenceIo},put:forbidEvidenceIo,get:forbidEvidenceIo,analyzer:{analyzePhoto:forbidEvidenceIo,transcribeAudio:forbidEvidenceIo,analyzeVideo:forbidEvidenceIo}}),evidenceProcessor=createMetaCustomerProcessor({connect,environment,dispatch:async ctx=>{const result=await evidenceBridge.execute(ctx);dispatched.set(ctx.eventId,result);return result;},outbound:{send:async()=>({replySent:false,state:'SYNTHETIC_NOT_SENT'})}});\n const evidencePush=message=>push(message,{processorOverride:evidenceProcessor});\n async function evidenceChoose(plan,title){assert.equal(plan.result.reply.type,'interactive');const row=plan.result.reply.sections.flatMap(section=>section.rows).find(value=>value.title===title);assert.ok(row,'Missing consumption evidence choice '+title);return evidencePush({type:'interactive',interactive:{type:'list_reply',list_reply:{id:row.id,title:row.title}}});}\n async function evidenceBegin(){await evidencePush('CANCELAR');let plan=await evidencePush('CONSUMO');plan=await evidenceChoose(plan,'Sin tarea asociada');plan=await evidenceChoose(plan,'Sector sintético');return evidenceChoose(plan,'Cemento catálogo sintéti');}\n const beforeEvidence=await evidenceBusiness();let evidencePlan=await evidenceBegin();assert.doesNotMatch(evidencePlan.result.reply.body,/Usamos 0,001/);evidencePlan=await evidenceChoose(evidencePlan,'Foto consumo nativo');evidencePlan=await evidenceChoose(evidencePlan,'Audio consumo nativo');assert.match(evidencePlan.result.reply.body,/Cantidad sugerida: 0\\.001 bolsa/);assert.deepEqual(await evidenceBusiness(),beforeEvidence);assert.equal(evidenceProviderCalls,0);\n const reviewedEvidence=await evidenceChoose(evidencePlan,'Usar este borrador');assert.match(reviewedEvidence.result.reply.body,/Adjuntos privados: 2/);assert.deepEqual(await evidenceBusiness(),beforeEvidence);\n const savedEvidence=await evidenceChoose(reviewedEvidence,'Guardar');assert.equal(savedEvidence.result.kind,'CONSUMPTION_PROPOSAL');assert.equal(savedEvidence.result.businessApplied,true);assert.equal(evidenceProviderCalls,0);\n const storedEvidenceRows=(await pool.query(`SELECT id,metadata FROM public.\"Incident\" WHERE \"projectId\"='p-a' AND metadata->'materialInventory'->>'kind'='CONSUMPTION' AND metadata->'materialInventory'->>'proposalReceiptId'=$1`,[savedEvidence.result.receiptId])).rows;assert.equal(storedEvidenceRows.length,1);const storedEvidence=storedEvidenceRows[0].metadata.materialInventory;assert.equal(storedEvidence.state,'PENDING');assert.equal(storedEvidence.quantity,'0.001');assert.equal(storedEvidence.unit,'bolsa');assert.equal(storedEvidence.source,'participant-whatsapp');assert.deepEqual(storedEvidence.evidenceIds,[...evidenceIds].sort());assert.deepEqual(storedEvidence.evidenceBindings.map(row=>row.id),[...evidenceIds].sort());assert.ok(storedEvidence.evidenceBindings.every(row=>row.media.sha256===evidenceHash));\n const afterEvidenceSave=await evidenceBusiness();assert.equal(afterEvidenceSave.consumptions,beforeEvidence.consumptions+1);assert.equal(afterEvidenceSave.movements,beforeEvidence.movements);assert.equal(afterEvidenceSave.balance,beforeEvidence.balance);assert.deepEqual(afterEvidenceSave.task,beforeEvidence.task);\n const replayedEvidence=await evidenceProcessor.recover({eventIds:[savedEvidence.eventId]});assert.equal(replayedEvidence.results[0].done,true);assert.deepEqual(dispatched.get(savedEvidence.eventId),savedEvidence.result);assert.deepEqual(await evidenceBusiness(),afterEvidenceSave);\n const persistedEvidence=(await field.inventoryHistory(director,{...(await evidenceContext(director)),consumptionId:storedEvidenceRows[0].id})).inventory.consumptions[0],approvalEvidence=command(await evidenceContext(director),'DECIDE_CONSUMPTION',{proposalId:persistedEvidence.id,revision:persistedEvidence.revision,catalogHash:(await evidenceRead()).inventory.catalogHash,decision:'APPROVE',reason:'Revisión independiente del original, cantidad y material sintéticos.'});\n await assert.rejects(field.save(worker,{...approvalEvidence,scope:(await evidenceContext(worker)).scope}),{code:'INVENTORY_MANAGE_REQUIRED'});\n const approvedEvidence=await Promise.all([field.save(director,approvalEvidence),field.save(director,approvalEvidence)]);assert.equal(approvedEvidence.filter(value=>!value.replayed).length,1);assert.ok(approvedEvidence.every(value=>value.consumption.state==='APPROVED'));\n const afterEvidenceApproval=await evidenceBusiness();assert.equal(afterEvidenceApproval.movements,afterEvidenceSave.movements+1);assert.equal(afterEvidenceApproval.balance,(Number(afterEvidenceSave.balance)-0.001).toFixed(3));assert.deepEqual(afterEvidenceApproval.task,beforeEvidence.task);assert.equal((await field.save(director,approvalEvidence)).replayed,true);assert.deepEqual(await evidenceBusiness(),afterEvidenceApproval);assert.equal(evidenceProviderCalls,0);\n checks.push('signed-consumption-photo-and-consented-persisted-audio-explicit-draft-then-final-confirmation-PENDING-replay-and-independent-single-stock-debit-without-media-IO');\n\n async function photoConfirmation(){let plan=await evidenceBegin();plan=await evidenceChoose(plan,'Foto consumo nativo');plan=await evidenceChoose(plan,'Continuar con 1 adjunto');plan=await evidencePush('0.001');return evidencePush('Material usado en el sector sintético con foto previamente guardada.');}\n async function restorePhoto(){await pool.query(`INSERT INTO public.\"Incident\"(id,\"projectId\",title,description,metadata,\"createdAt\",\"updatedAt\") VALUES($1,'p-a','Foto consumo nativo','Previously saved synthetic private original',$2::jsonb,timestamp '2020-01-01',timestamp '2020-01-02 00:00:00.000001') ON CONFLICT(id) DO UPDATE SET metadata=EXCLUDED.metadata,\"updatedAt\"=EXCLUDED.\"updatedAt\"`,[evidenceIds[0],JSON.stringify(evidenceOriginals.get(evidenceIds[0]))]);}\n const rejectedEvidenceVariants=[];\n for(const variant of ['removed','rejected','author-reassigned','hash-changed']){\n  const confirmation=await photoConfirmation(),beforeDeniedEvidence=await evidenceBusiness();\n  if(variant==='removed')await pool.query(`DELETE FROM public.\"Incident\" WHERE id=$1`,[evidenceIds[0]]);\n  else{const changed=structuredClone(evidenceOriginals.get(evidenceIds[0]));if(variant==='rejected')changed.fieldOperations.review={decision:'REJECT'};else if(variant==='author-reassigned')changed.fieldOperations.recordedBy='owner';else changed.fieldOperations.media.sha256='b'.repeat(64);await pool.query(`UPDATE public.\"Incident\" SET metadata=$2::jsonb,\"updatedAt\"=clock_timestamp() WHERE id=$1`,[evidenceIds[0],JSON.stringify(changed)]);}\n  const denied=await evidenceChoose(confirmation,'Guardar');assert.equal(denied.result.businessApplied,false);assert.match(denied.result.reply.body,/adjunto.*cambió/i);assert.deepEqual(await evidenceBusiness(),beforeDeniedEvidence);\n  const workerEnvelope=(await pool.query(`SELECT metadata->'fieldChannelConversation' AS draft FROM public.\"Worker\" WHERE id='w-worker'`)).rows[0].draft;assert.ok(workerEnvelope?.encryptedState);\n  const originalSectors=(await pool.query(`SELECT metadata->'fieldOperations'->'sectors' AS sectors FROM public.\"Project\" WHERE id='p-a'`)).rows[0].sectors;\n  if(variant==='removed')await pool.query(`UPDATE public.\"Project\" SET metadata=jsonb_set(metadata,'{fieldOperations,sectors}','[]'::jsonb) WHERE id='p-a'`);\n  try{const cancelled=await evidenceChoose(confirmation,'Cancelar');assert.equal(cancelled.result.businessApplied,false);assert.match(cancelled.result.reply.body,/cancelada/);assert.equal((await pool.query(`SELECT metadata->'fieldChannelConversation' AS draft FROM public.\"Worker\" WHERE id='w-worker'`)).rows[0].draft??null,null);}finally{if(variant==='removed')await pool.query(`UPDATE public.\"Project\" SET metadata=jsonb_set(metadata,'{fieldOperations,sectors}',$1::jsonb) WHERE id='p-a'`,[JSON.stringify(originalSectors)]);await restorePhoto();}\n  assert.deepEqual(await evidenceBusiness(),beforeDeniedEvidence);rejectedEvidenceVariants.push(variant);\n }\n const staleApprovalConfirmation=await photoConfirmation(),staleApprovalSaved=await evidenceChoose(staleApprovalConfirmation,'Guardar'),staleApprovalRow=(await pool.query(`SELECT id FROM public.\"Incident\" WHERE \"projectId\"='p-a' AND metadata->'materialInventory'->>'proposalReceiptId'=$1`,[staleApprovalSaved.result.receiptId])).rows;assert.equal(staleApprovalRow.length,1);\n const staleApprovalProposal=(await field.inventoryHistory(director,{...(await evidenceContext(director)),consumptionId:staleApprovalRow[0].id})).inventory.consumptions[0],beforeStaleApproval=await evidenceBusiness();\n await pool.query(`UPDATE public.\"Incident\" SET metadata=jsonb_set(metadata,'{fieldOperations,review}','{\"decision\":\"REJECT\"}'::jsonb),\"updatedAt\"=clock_timestamp() WHERE id=$1`,[evidenceIds[0]]);\n try{await assert.rejects(field.save(director,command(await evidenceContext(director),'DECIDE_CONSUMPTION',{proposalId:staleApprovalProposal.id,revision:staleApprovalProposal.revision,catalogHash:(await evidenceRead()).inventory.catalogHash,decision:'APPROVE',reason:'Relectura independiente rechaza el original retirado.'})),{code:'INVENTORY_EVIDENCE_UNAVAILABLE'});assert.deepEqual(await evidenceBusiness(),beforeStaleApproval);}finally{await restorePhoto();}\n assert.deepEqual(rejectedEvidenceVariants,['removed','rejected','author-reassigned','hash-changed']);assert.equal(evidenceProviderCalls,0);\n checks.push('signed-consumption-retained-evidence-removal-rejection-author-and-hash-change-block-Save-preserve-draft-allow-retired-sector-Cancel-and-block-stale-approval');\n\n for(const entry of sourceManifest)assert.equal(fileHash(entry.path),entry.sha256,'Source changed during disposable PostgreSQL verification: '+entry.path);\n const report={status:'PASS',sourceManifest,harnessSha256,checks,checkCount:checks.length,materialReviewQueue,homeDecisions,participantKycFixture:{records:kycFixture.records,syntheticPrivateCalls:kycFixture.calls,providerCalls:0,identityCertified:false},environment:'disposable-localhost-canonical-material-inventory',tenants:2,providerCalls:0,productionDataTouched:false,humanAccepted:false,newTables:false};mkdirSync('.vercel/material-inventory-evidence',{recursive:true});writeFileSync('.vercel/material-inventory-evidence/postgres.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));\n",
              "previousText": " const homeDecisions={projection:'decisions',sqlQueriesPerRead:2,authorizedReads:homeReads,progressPending:2,materialPendingPerKind:202,foreignProgressPending:1,excludedExpiredClosedProviderAndVersion:true,canonicalReadOnly:true,businessStateUnchanged:true,providerCalls:0};\n checks.push('native-home-decisions-read-uses-two-canonical-same-snapshot-aggregates-with-current-progress-material-totals-tenant-role-scope-denials-and-no-business-write');\n for(const entry of sourceManifest)assert.equal(fileHash(entry.path),entry.sha256,'Source changed during disposable PostgreSQL verification: '+entry.path);\n const report={status:'PASS',sourceManifest,harnessSha256,checks,checkCount:checks.length,materialReviewQueue,homeDecisions,participantKycFixture:{records:kycFixture.records,syntheticPrivateCalls:kycFixture.calls,providerCalls:0,identityCertified:false},environment:'disposable-localhost-canonical-material-inventory',tenants:2,providerCalls:0,productionDataTouched:false,humanAccepted:false,newTables:false};mkdirSync('.vercel/material-inventory-evidence',{recursive:true});writeFileSync('.vercel/material-inventory-evidence/postgres.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));\n"
            }
          ]
        }
      }
    ],
    "nativeSupplements": [
      {
        "producer": "scripts/verify-meta-field-bridge-postgres.mjs",
        "previousCheckNames": [
          "actual-HMAC-callback-encrypted-inbox-leased-context-and-single-use-account-bound-channel",
          "signed-GANTT-CRONOGRAMA-real-SQL-dates-status-progress-report-false-read-draft-byte-preservation-original-choice-sealed-current-and-synthetic-legacy-replay-zero-business-media-IO",
          "HOLA-and-MENU-cannot-open-field-menu-or-change-worker-ledger-and-private-IO-without-current-approved-KYC",
          "HOLA-and-MENU-signed-source-cannot-be-retargeted-to-a-foreign-project-or-read-with-another-tenant-principal",
          "help-menu-and-stale-choice-capabilities-never-authorize-a-business-write",
          "PROJECT_ONLY-HOLA-preserves-exact-worker-draft-TTL-nonce-prompt-and-replay-with-no-ledger-effect-original-choice-still-current",
          "signed-invalid-quantity-finishes-as-correction-once-with-encrypted-draft-no-business-effect-and-no-job-retry",
          "canonical-current-worker-permissions-filter-menus-and-return-safe-denials-with-no-business-write",
          "incident-guided-confirmation-writes-existing-site-register-once-and-is-visible-to-web-responsible",
          "material-guided-correction-preserves-name-task-sector-and-records-one-request-without-purchase-or-task-approval",
          "WhatsApp-location-preserves-unknown-precision-and-missing-QR-with-human-review-required",
          "canonical-current-journey-menu-completes-pause-resume-out-and-stale-web-race-cannot-record-an-extra-event",
          "signed-provider-media-download-private-byte-readback-and-analyzer-never-approve-evidence-or-task",
          "explicit-versioned-image-audio-video-analysis-choice-real-synthetic-video-decode-private-original-replay-and-failed-processing-receipt-preserve-task",
          "encrypted-progress-draft-corrections-survive-service-restart-and-only-authorized-web-decision-changes-Gantt-progress",
          "altered-event-digest-lease-channel-scope-and-foreign-tenant-cannot-write-or-read-worksite-effects",
          "lost-commit-response-recovers-one-deterministic-conversation-receipt",
          "business-and-conversation-audit-failure-rolls-back-report-before-exact-retry",
          "real-participant-revoke-and-restore-never-resurrect-old-binding-or-conversation",
          "draft-private-caption-result-and-conversation-state-are-ciphertext-with-tenant-project-resource-AAD-replay-rejection",
          "revocation-during-provider-I-O-cannot-attach-media-and-exact-current-permission-retry-recovers-encrypted-preparation",
          "KYC-resubmission-and-new-human-approval-require-fresh-channel-proof-and-preserve-old-origin-audit",
          "old-provider-timestamp-and-earlier-queued-text-preserve-newest-draft-ciphertext-exactly",
          "sector-removed-during-private-put-finalizes-job-without-evidence-and-restoration-requires-new-explicit-upload",
          "authentic-target-task-removal-and-revision-races-close-once-with-no-evidence-analysis-or-retry-after-restoration",
          "invalid-original-proof-with-missing-task-remains-pending-without-business-context-receipt-and-valid-exact-retry-recovers",
          "human-web-review-between-attach-and-processing-finalizes-job-with-private-file-and-no-analysis-repeat-or-task-change",
          "task-catalog-real-PG-keyset-microseconds-ties-inclusion-backward-optional-empty-selected-id-and-foreign-stale-cursor-boundaries",
          "signed-task-consultation-reaches-all189-with-bounded-pages-backward-forward-and-no-business-or-media-IO",
          "signed-MENU-interactive-incident-material-consumption-use-seven-item-page-and-next-starts-at-task8-without-skips",
          "encrypted-legacy-ten-choice-TASK-draft-selects-tasks9-and10-by-current-project-id-without-restarting-or-effects",
          "signed-optional-NONE-survives-empty-taskPage-and-sector-selection-without-creating-an-incident",
          "pagination-stale-nonce-live-membership-report-permission-foreign-retarget-and-exact-restored-replay-cannot-authorize-effects",
          "signed-page-two-task11-private-evidence-keeps-task-worker-attribution-and-exact-replay-one-file-one-receipt",
          "signed-task189-beyond101-private-evidence-approved-progress-concurrent-replay-one-proposal-and-web-decision-only-task-update",
          "approved-evidence-real-PG11-beyond100-feed-keyset-ties-canonical-selected-id-task-author-worker-tenant-and-stale-nonce",
          "signed-approved-evidence11-old-snapshot-paging-HOLA-stale-nonce-no-business-IO-current-review-final-block-and-exact-concurrent-replay",
          "progress-evidence-wait-preserves-exact-quantity-task-sector-deadline-after-restart-explicit-recheck-stale-nonce-status-and-event-replay-without-business-media-IO",
          "progress-evidence-wait-pending-rejected-foreign-task-worker-author-and-tenant-records-cannot-satisfy-the-current-approved-catalog",
          "progress-evidence-wait-canonical-review-pending-error-rolls-back-and-retains-exact-ciphertext-deadline-origin-and-measurement-without-an-extra-proposal",
          "progress-evidence-wait-independent-human-approval-unlocks-explicit-evidence-reason-and-confirmation-one-new-proposal-concurrent-replay-without-changing-Task-progress",
          "progress-evidence-wait-revoked-membership-foreign-source-and-changed-measurement-definition-preserve-ledger-and-never-adopt-a-new-base",
          "progress-evidence-wait-exact-marker-deadline-header-and-worker-AAD-tampering-are-rejected-without-a-dispatch-or-business-ledger-effect",
          "progress-evidence-wait-deleted-task-HOLA-preserves-exact-encrypted-origin-and-interactive-cancel-clears-the-draft-without-reading-a-missing-target-or-proposing",
          "progress-evidence-wait-real-SQL-clock-crosses-fixed-deadline-after-catalog-await-and-recovers-one-expiry-receipt-with-no-proposal-or-TTL-renewal",
          "progress-evidence-wait-real-SQL-expiry-after-proposal-INSERT-rolls-back-business-Task-Incident-Proposal-Audit-and-retains-exact-encrypted-confirmation-for-one-expiry-replay"
        ],
        "addedCheckNames": [
          "consumption-evidence-real-PG-own13-beyond100-foreign-keyset-six-row-ties-null-task-minimal-DTO-and-stale-anchor-scope",
          "consumption-retained-ten-outside-page-use-one-scoped-sorted-ANY-share-lock-that-blocks-real-UPDATE-until-owner-commit"
        ],
        "previousChecksSha256": "b29d6cab120dfbf1bd92d125a3291e100085b99d3d48a6402b7bf1707ef85cca",
        "currentChecksSha256": "da17adfc5761b72e51fc2a662b904505274fda57643b8e27e08511203f0b807b",
        "sourceManifestAdvance": null
      },
      {
        "producer": "scripts/verify-material-inventory-postgres.mjs",
        "previousCheckNames": [
          "bounded-stable-catalog-uses-canonical-project-role-and-tenant-gates-and-replays-one-material",
          "authorized-reception-catalog-assignment-and-exact-balance-commit-once-with-purchase-receipt-and-ledger-failure-rolls-back-all",
          "two-responsible-actors-enforce-maker-checker-and-authorized-distinct-reviewer-reversal-once-with-immutable-original-movement",
          "concurrent-distinct-consumptions-share-Project-lock-and-never-negative-with-failed-decision-still-pending",
          "worker-ownership-KYC-report-permission-and-fresh-participation-remain-required-before-proposal-and-approved-deduction",
          "approval-retains-worker-user-global-membership-and-project-assignment-share-locks-and-concurrent-prior-revocation-yields-no-debit-or-receipt",
          "lost-COMMIT-response-status-and-exact-replay-recover-original-debit-without-deducting-twice",
          "proposal-and-reception-pin-current-catalog-and-exact-unit-with-stale-proposal-rejection-still-available",
          "actual-keyset-history-is-tenant-project-scoped-and-metadata-channel-and-field-configuration-survive-exact-Decimal-14-3-boundaries",
          "signed-WhatsApp-individual-KYC-binding-leased-encrypted-inbox-explicit-confirmation-proposes-once-with-no-stock-effect-until-distinct-web-review-and-current-permission-denial",
          "stable-material-id-includes-canonical-actor-so-two-responsible-actors-reusing-an-operation-UUID-cannot-corrupt-catalog",
          "consumption-keyset-reaches-more-than-100-pending-and-rejected-records-without-movements-worker-ownership-and-foreign-cursor-denial-independent-ledger-cursor-and-exact-page-two-review-readback",
          "revoked-membership-cannot-recover-an-old-approved-consumption-receipt",
          "opening-proposes-without-stock-effect-distinct-admin-director-approval-atomic-once-replay-conflict-and-tenant-role-denials",
          "counted-difference-uses-exact-decimals-rejects-stale-saldo-and-underflow-without-changing-stock",
          "stock-adjustment-ledger-failure-rolls-back-receipt-proposal-balance-and-lost-commit-ACK-recovers-one-movement",
          "historical-receipt-binds-original-audited-source-unit-and-exact-quantity-incorporates-once-under-concurrency-without-new-receipt-or-purchase-change",
          "concurrent-proposer-account-revocation-locks-before-project-and-blocks-new-approval-without-deadlock-or-stock-write",
          "stock-adjustment-directed-read-pagination-and-history-remain-private-to-authorized-project-reviewers",
          "native-pending-queues-skip-151-newer-closed-records-each-and-page-all-203-pending-consumptions-and-adjustments-with-complete-counts-canonical-read-only-repeatable-read-and-unchanged-business-state",
          "native-pending-material-review-retains-ADMIN-DIRECTOR-only-role-scope-original-author-maker-checker-and-cross-company-wrong-kind-cursor-denials",
          "native-operations-status-reuses-complete-pending-material-counts-matching-an-unbounded-independent-read-inside-the-same-canonical-project-snapshot",
          "native-canonical-rejection-updates-microsecond-revision-while-decided-cursor-remains-usable-for-the-next-pending-page-and-directed-ALL-recovery-keeps-stock-unchanged",
          "native-home-decisions-read-uses-two-canonical-same-snapshot-aggregates-with-current-progress-material-totals-tenant-role-scope-denials-and-no-business-write"
        ],
        "addedCheckNames": [
          "signed-consumption-photo-and-consented-persisted-audio-explicit-draft-then-final-confirmation-PENDING-replay-and-independent-single-stock-debit-without-media-IO",
          "signed-consumption-retained-evidence-removal-rejection-author-and-hash-change-block-Save-preserve-draft-allow-retired-sector-Cancel-and-block-stale-approval"
        ],
        "previousChecksSha256": "5ccaaa5baf8da816b1f4586551d27669301940ed0ad28b91f7b2c69f9726188f",
        "currentChecksSha256": "eac8c0f2aa9869c34eef9e1c63bf17b5094310350a53b08db439b8f41f71b2c4",
        "sourceManifestAdvance": {
          "parentHead": "756b788f30ac6d778db3a0867548f0c3c27c5c9f",
          "previousFiles": [
            "package-lock.json",
            "package.json",
            "scripts/fixtures/canonical-participant-kyc.mjs",
            "scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs",
            "scripts/lib/disposable-postgres-cleanup.mjs",
            "scripts/verify-material-inventory-postgres.mjs",
            "src/app/(identity)/cuenta/material-inventory-view.mjs",
            "src/app/(identity)/cuenta/private-bank-account-format.mjs",
            "src/lib/bindx-civil-data-client.mjs",
            "src/lib/brand-assets.mjs",
            "src/lib/canonical-invited-account.mjs",
            "src/lib/company-channel-connection.mjs",
            "src/lib/company-channel-kyc.mjs",
            "src/lib/company-channel-routing.mjs",
            "src/lib/company-channel-schema.mjs",
            "src/lib/company-entitlement.mjs",
            "src/lib/company-onboarding-policy.mjs",
            "src/lib/company-phone-format.mjs",
            "src/lib/employee-intake-channel-continuity.mjs",
            "src/lib/field-media-privacy.mjs",
            "src/lib/field-media.mjs",
            "src/lib/field-operations-http.mjs",
            "src/lib/field-operations-policy.mjs",
            "src/lib/field-operations-store.mjs",
            "src/lib/field-overtime-policy.mjs",
            "src/lib/field-overtime-store.mjs",
            "src/lib/field-report-feedback.mjs",
            "src/lib/field-shift-summary.mjs",
            "src/lib/geo.js",
            "src/lib/legacy-access-boundary.js",
            "src/lib/material-inventory.mjs",
            "src/lib/meta-callback-diagnostics.mjs",
            "src/lib/meta-channel-binding.mjs",
            "src/lib/meta-cloud-protocol.mjs",
            "src/lib/meta-customer-app-projection.mjs",
            "src/lib/meta-customer-callback.mjs",
            "src/lib/meta-customer-coexistence.mjs",
            "src/lib/meta-customer-credentials.mjs",
            "src/lib/meta-customer-inbox-review.mjs",
            "src/lib/meta-customer-outbound.mjs",
            "src/lib/meta-customer-permissions.mjs",
            "src/lib/meta-customer-processing.mjs",
            "src/lib/meta-customer-provider.mjs",
            "src/lib/meta-customer-templates.mjs",
            "src/lib/meta-development-pilot-policy.mjs",
            "src/lib/meta-employee-intake.mjs",
            "src/lib/meta-field-bridge.mjs",
            "src/lib/meta-field-conversation.mjs",
            "src/lib/meta-kyc-challenge.mjs",
            "src/lib/meta-kyc-conversation.mjs",
            "src/lib/meta-kyc-current-image.mjs",
            "src/lib/meta-kyc-identity.mjs",
            "src/lib/meta-kyc-rejection-policy.mjs",
            "src/lib/meta-kyc-rejection.mjs",
            "src/lib/meta-own-company-policy.mjs",
            "src/lib/meta-plan-import-conversation.mjs",
            "src/lib/meta-plan-import-origin.mjs",
            "src/lib/meta-plan-import-transport.mjs",
            "src/lib/meta-test-recipient-binding.mjs",
            "src/lib/meta-whatsapp-transport.mjs",
            "src/lib/operations-status.mjs",
            "src/lib/organization-resource-usage-policy.mjs",
            "src/lib/organization-usage-policy.mjs",
            "src/lib/participant-account-discovery.mjs",
            "src/lib/participant-admission.mjs",
            "src/lib/participant-analysis-consent.mjs",
            "src/lib/participant-approved-identity.mjs",
            "src/lib/participant-bank-account.mjs",
            "src/lib/participant-bank-format.mjs",
            "src/lib/participant-bank-vault.mjs",
            "src/lib/participant-channel-kyc.mjs",
            "src/lib/participant-civil-policy.mjs",
            "src/lib/participant-civil-store.mjs",
            "src/lib/participant-kyc-chat-attempt.mjs",
            "src/lib/participant-kyc-chat-closure.mjs",
            "src/lib/participant-kyc-chat-copy.mjs",
            "src/lib/participant-kyc-image-set.mjs",
            "src/lib/participant-kyc-notice-links.mjs",
            "src/lib/participant-kyc-preanalysis-policy.mjs",
            "src/lib/participant-onboarding-authority.mjs",
            "src/lib/participant-onboarding-current-kyc.mjs",
            "src/lib/participant-onboarding-delivery.mjs",
            "src/lib/participant-onboarding-intent.mjs",
            "src/lib/participant-onboarding-policy.mjs",
            "src/lib/participant-onboarding-reactive.mjs",
            "src/lib/participant-policy.mjs",
            "src/lib/participant-store.mjs",
            "src/lib/participant-verified-office.mjs",
            "src/lib/person-worksite-journey.mjs",
            "src/lib/pilot-media.mjs",
            "src/lib/plan-baseline-policy.mjs",
            "src/lib/plan-import-cyp-curve.mjs",
            "src/lib/plan-import-document-curve.mjs",
            "src/lib/plan-import-monthly-curve.mjs",
            "src/lib/plan-import-ooxml.mjs",
            "src/lib/plan-import-policy.mjs",
            "src/lib/plan-import-store.mjs",
            "src/lib/plan-measurement-policy.mjs",
            "src/lib/plan-measurement-source.mjs",
            "src/lib/private-image-upload.mjs",
            "src/lib/procurement-money.js",
            "src/lib/procurement-quantity.js",
            "src/lib/production-identity-config.mjs",
            "src/lib/progress-measurement-quantity.js",
            "src/lib/site-purchase-policy.mjs",
            "src/lib/site-purchase-store.mjs",
            "src/lib/site-register-policy.mjs",
            "src/lib/site-register-store.mjs",
            "src/lib/task-progress-measurement.js",
            "src/lib/video-audio-extractor.mjs",
            "src/lib/video-frame-extractor.mjs",
            "src/lib/voice-progress-draft.mjs",
            "src/lib/whatsapp/field-worker-intent-policy.js",
            "src/lib/whatsapp/obra-intent-policy.js",
            "src/lib/whatsapp/operational-proposal-decision-policy.js",
            "src/lib/whatsapp/project-workspace-profile.js",
            "src/lib/whatsapp/template-review-policy.js",
            "src/lib/whatsapp/tenant-workspace-policy.js",
            "src/lib/worker-channel-consent-policy.mjs",
            "src/lib/worker-channel-identity.mjs",
            "src/lib/workspace-http.mjs",
            "src/lib/workspace-policy.mjs",
            "src/lib/workspace-store.mjs",
            "tests/production-material-inventory-review-queue.test.mjs",
            "tests/production-material-inventory.test.mjs"
          ],
          "parentFiles": [
            "package-lock.json",
            "package.json",
            "scripts/fixtures/canonical-participant-kyc.mjs",
            "scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs",
            "scripts/lib/disposable-postgres-cleanup.mjs",
            "scripts/verify-material-inventory-postgres.mjs",
            "src/app/(identity)/cuenta/material-inventory-view.mjs",
            "src/app/(identity)/cuenta/private-bank-account-format.mjs",
            "src/lib/bindx-civil-data-client.mjs",
            "src/lib/brand-assets.mjs",
            "src/lib/canonical-invited-account.mjs",
            "src/lib/company-channel-connection.mjs",
            "src/lib/company-channel-kyc.mjs",
            "src/lib/company-channel-routing.mjs",
            "src/lib/company-channel-schema.mjs",
            "src/lib/company-entitlement.mjs",
            "src/lib/company-onboarding-policy.mjs",
            "src/lib/company-phone-format.mjs",
            "src/lib/employee-intake-channel-continuity.mjs",
            "src/lib/field-hours-report.mjs",
            "src/lib/field-media-privacy.mjs",
            "src/lib/field-media.mjs",
            "src/lib/field-operations-http.mjs",
            "src/lib/field-operations-policy.mjs",
            "src/lib/field-operations-store.mjs",
            "src/lib/field-overtime-policy.mjs",
            "src/lib/field-overtime-store.mjs",
            "src/lib/field-report-feedback.mjs",
            "src/lib/field-shift-summary.mjs",
            "src/lib/geo.js",
            "src/lib/legacy-access-boundary.js",
            "src/lib/material-inventory.mjs",
            "src/lib/meta-callback-diagnostics.mjs",
            "src/lib/meta-channel-binding.mjs",
            "src/lib/meta-cloud-protocol.mjs",
            "src/lib/meta-customer-app-projection.mjs",
            "src/lib/meta-customer-callback.mjs",
            "src/lib/meta-customer-coexistence.mjs",
            "src/lib/meta-customer-credentials.mjs",
            "src/lib/meta-customer-inbox-review.mjs",
            "src/lib/meta-customer-outbound.mjs",
            "src/lib/meta-customer-permissions.mjs",
            "src/lib/meta-customer-processing.mjs",
            "src/lib/meta-customer-provider.mjs",
            "src/lib/meta-customer-templates.mjs",
            "src/lib/meta-development-pilot-policy.mjs",
            "src/lib/meta-employee-intake.mjs",
            "src/lib/meta-field-bridge.mjs",
            "src/lib/meta-field-conversation.mjs",
            "src/lib/meta-kyc-challenge.mjs",
            "src/lib/meta-kyc-conversation.mjs",
            "src/lib/meta-kyc-current-image.mjs",
            "src/lib/meta-kyc-identity.mjs",
            "src/lib/meta-kyc-rejection-policy.mjs",
            "src/lib/meta-kyc-rejection.mjs",
            "src/lib/meta-own-company-policy.mjs",
            "src/lib/meta-plan-import-conversation.mjs",
            "src/lib/meta-plan-import-origin.mjs",
            "src/lib/meta-plan-import-transport.mjs",
            "src/lib/meta-test-recipient-binding.mjs",
            "src/lib/meta-whatsapp-transport.mjs",
            "src/lib/operations-status.mjs",
            "src/lib/organization-resource-usage-policy.mjs",
            "src/lib/organization-usage-policy.mjs",
            "src/lib/participant-account-discovery.mjs",
            "src/lib/participant-admission.mjs",
            "src/lib/participant-analysis-consent.mjs",
            "src/lib/participant-approved-identity.mjs",
            "src/lib/participant-bank-account.mjs",
            "src/lib/participant-bank-format.mjs",
            "src/lib/participant-bank-vault.mjs",
            "src/lib/participant-channel-kyc.mjs",
            "src/lib/participant-civil-policy.mjs",
            "src/lib/participant-civil-store.mjs",
            "src/lib/participant-kyc-chat-attempt.mjs",
            "src/lib/participant-kyc-chat-closure.mjs",
            "src/lib/participant-kyc-chat-copy.mjs",
            "src/lib/participant-kyc-image-set.mjs",
            "src/lib/participant-kyc-notice-links.mjs",
            "src/lib/participant-kyc-preanalysis-policy.mjs",
            "src/lib/participant-onboarding-authority.mjs",
            "src/lib/participant-onboarding-current-kyc.mjs",
            "src/lib/participant-onboarding-delivery.mjs",
            "src/lib/participant-onboarding-intent.mjs",
            "src/lib/participant-onboarding-policy.mjs",
            "src/lib/participant-onboarding-reactive.mjs",
            "src/lib/participant-policy.mjs",
            "src/lib/participant-store.mjs",
            "src/lib/participant-verified-office.mjs",
            "src/lib/person-worksite-journey.mjs",
            "src/lib/pilot-media.mjs",
            "src/lib/plan-baseline-policy.mjs",
            "src/lib/plan-budget-source.mjs",
            "src/lib/plan-import-cyp-curve.mjs",
            "src/lib/plan-import-document-curve.mjs",
            "src/lib/plan-import-monthly-curve.mjs",
            "src/lib/plan-import-ooxml.mjs",
            "src/lib/plan-import-policy.mjs",
            "src/lib/plan-import-store.mjs",
            "src/lib/plan-measurement-policy.mjs",
            "src/lib/plan-measurement-source.mjs",
            "src/lib/private-image-upload.mjs",
            "src/lib/procurement-money.js",
            "src/lib/procurement-quantity.js",
            "src/lib/production-identity-config.mjs",
            "src/lib/progress-measurement-quantity.js",
            "src/lib/site-purchase-policy.mjs",
            "src/lib/site-purchase-store.mjs",
            "src/lib/site-register-policy.mjs",
            "src/lib/site-register-store.mjs",
            "src/lib/task-progress-measurement.js",
            "src/lib/video-audio-extractor.mjs",
            "src/lib/video-frame-extractor.mjs",
            "src/lib/voice-progress-draft.mjs",
            "src/lib/whatsapp/field-worker-intent-policy.js",
            "src/lib/whatsapp/obra-intent-policy.js",
            "src/lib/whatsapp/operational-proposal-decision-policy.js",
            "src/lib/whatsapp/project-workspace-profile.js",
            "src/lib/whatsapp/template-review-policy.js",
            "src/lib/whatsapp/tenant-workspace-policy.js",
            "src/lib/worker-channel-consent-policy.mjs",
            "src/lib/worker-channel-identity.mjs",
            "src/lib/workspace-http.mjs",
            "src/lib/workspace-policy.mjs",
            "src/lib/workspace-store.mjs",
            "tests/production-material-inventory-review-queue.test.mjs",
            "tests/production-material-inventory.test.mjs"
          ],
          "currentFiles": [
            "package-lock.json",
            "package.json",
            "scripts/fixtures/canonical-participant-kyc.mjs",
            "scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs",
            "scripts/lib/disposable-postgres-cleanup.mjs",
            "scripts/verify-material-inventory-postgres.mjs",
            "src/app/(identity)/cuenta/material-inventory-view.mjs",
            "src/app/(identity)/cuenta/private-bank-account-format.mjs",
            "src/lib/bindx-civil-data-client.mjs",
            "src/lib/brand-assets.mjs",
            "src/lib/canonical-invited-account.mjs",
            "src/lib/company-channel-connection.mjs",
            "src/lib/company-channel-kyc.mjs",
            "src/lib/company-channel-routing.mjs",
            "src/lib/company-channel-schema.mjs",
            "src/lib/company-entitlement.mjs",
            "src/lib/company-onboarding-policy.mjs",
            "src/lib/company-phone-format.mjs",
            "src/lib/employee-intake-channel-continuity.mjs",
            "src/lib/field-hours-report.mjs",
            "src/lib/field-media-privacy.mjs",
            "src/lib/field-media.mjs",
            "src/lib/field-operations-http.mjs",
            "src/lib/field-operations-policy.mjs",
            "src/lib/field-operations-store.mjs",
            "src/lib/field-overtime-policy.mjs",
            "src/lib/field-overtime-store.mjs",
            "src/lib/field-report-feedback.mjs",
            "src/lib/field-shift-summary.mjs",
            "src/lib/geo.js",
            "src/lib/legacy-access-boundary.js",
            "src/lib/material-inventory.mjs",
            "src/lib/meta-callback-diagnostics.mjs",
            "src/lib/meta-channel-binding.mjs",
            "src/lib/meta-cloud-protocol.mjs",
            "src/lib/meta-consumption-evidence-catalog.mjs",
            "src/lib/meta-customer-app-projection.mjs",
            "src/lib/meta-customer-callback.mjs",
            "src/lib/meta-customer-coexistence.mjs",
            "src/lib/meta-customer-credentials.mjs",
            "src/lib/meta-customer-inbox-review.mjs",
            "src/lib/meta-customer-outbound.mjs",
            "src/lib/meta-customer-permissions.mjs",
            "src/lib/meta-customer-processing.mjs",
            "src/lib/meta-customer-provider.mjs",
            "src/lib/meta-customer-templates.mjs",
            "src/lib/meta-development-pilot-policy.mjs",
            "src/lib/meta-employee-intake.mjs",
            "src/lib/meta-field-bridge.mjs",
            "src/lib/meta-field-conversation.mjs",
            "src/lib/meta-kyc-challenge.mjs",
            "src/lib/meta-kyc-conversation.mjs",
            "src/lib/meta-kyc-current-image.mjs",
            "src/lib/meta-kyc-identity.mjs",
            "src/lib/meta-kyc-rejection-policy.mjs",
            "src/lib/meta-kyc-rejection.mjs",
            "src/lib/meta-own-company-policy.mjs",
            "src/lib/meta-plan-import-conversation.mjs",
            "src/lib/meta-plan-import-origin.mjs",
            "src/lib/meta-plan-import-transport.mjs",
            "src/lib/meta-test-recipient-binding.mjs",
            "src/lib/meta-whatsapp-transport.mjs",
            "src/lib/operations-status.mjs",
            "src/lib/organization-resource-usage-policy.mjs",
            "src/lib/organization-usage-policy.mjs",
            "src/lib/participant-account-discovery.mjs",
            "src/lib/participant-admission.mjs",
            "src/lib/participant-analysis-consent.mjs",
            "src/lib/participant-approved-identity.mjs",
            "src/lib/participant-bank-account.mjs",
            "src/lib/participant-bank-format.mjs",
            "src/lib/participant-bank-vault.mjs",
            "src/lib/participant-channel-kyc.mjs",
            "src/lib/participant-civil-policy.mjs",
            "src/lib/participant-civil-store.mjs",
            "src/lib/participant-kyc-chat-attempt.mjs",
            "src/lib/participant-kyc-chat-closure.mjs",
            "src/lib/participant-kyc-chat-copy.mjs",
            "src/lib/participant-kyc-image-set.mjs",
            "src/lib/participant-kyc-notice-links.mjs",
            "src/lib/participant-kyc-preanalysis-policy.mjs",
            "src/lib/participant-onboarding-authority.mjs",
            "src/lib/participant-onboarding-current-kyc.mjs",
            "src/lib/participant-onboarding-delivery.mjs",
            "src/lib/participant-onboarding-intent.mjs",
            "src/lib/participant-onboarding-policy.mjs",
            "src/lib/participant-onboarding-reactive.mjs",
            "src/lib/participant-policy.mjs",
            "src/lib/participant-store.mjs",
            "src/lib/participant-verified-office.mjs",
            "src/lib/person-worksite-journey.mjs",
            "src/lib/pilot-media.mjs",
            "src/lib/plan-baseline-policy.mjs",
            "src/lib/plan-budget-source.mjs",
            "src/lib/plan-import-cyp-curve.mjs",
            "src/lib/plan-import-document-curve.mjs",
            "src/lib/plan-import-monthly-curve.mjs",
            "src/lib/plan-import-ooxml.mjs",
            "src/lib/plan-import-policy.mjs",
            "src/lib/plan-import-store.mjs",
            "src/lib/plan-measurement-policy.mjs",
            "src/lib/plan-measurement-source.mjs",
            "src/lib/private-image-upload.mjs",
            "src/lib/procurement-money.js",
            "src/lib/procurement-quantity.js",
            "src/lib/production-identity-config.mjs",
            "src/lib/progress-measurement-quantity.js",
            "src/lib/site-purchase-policy.mjs",
            "src/lib/site-purchase-store.mjs",
            "src/lib/site-register-policy.mjs",
            "src/lib/site-register-store.mjs",
            "src/lib/task-progress-measurement.js",
            "src/lib/video-audio-extractor.mjs",
            "src/lib/video-frame-extractor.mjs",
            "src/lib/voice-consumption-draft.mjs",
            "src/lib/voice-progress-draft.mjs",
            "src/lib/whatsapp/field-worker-intent-policy.js",
            "src/lib/whatsapp/obra-intent-policy.js",
            "src/lib/whatsapp/operational-proposal-decision-policy.js",
            "src/lib/whatsapp/project-workspace-profile.js",
            "src/lib/whatsapp/template-review-policy.js",
            "src/lib/whatsapp/tenant-workspace-policy.js",
            "src/lib/worker-channel-consent-policy.mjs",
            "src/lib/worker-channel-identity.mjs",
            "src/lib/workspace-http.mjs",
            "src/lib/workspace-policy.mjs",
            "src/lib/workspace-store.mjs",
            "tests/production-material-inventory-review-queue.test.mjs",
            "tests/production-material-inventory.test.mjs"
          ],
          "currentManifest": [
            {
              "path": "package-lock.json",
              "sha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449"
            },
            {
              "path": "package.json",
              "sha256": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d"
            },
            {
              "path": "scripts/fixtures/canonical-participant-kyc.mjs",
              "sha256": "09928b417f3319d76ba34fac91f89a1888f3a8e613bfde3775cac424cc441ccb"
            },
            {
              "path": "scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs",
              "sha256": "01c8bd9e25665963ff44a70bcebda734c53c73a569aa4dafe70bd41c2c809e0f"
            },
            {
              "path": "scripts/lib/disposable-postgres-cleanup.mjs",
              "sha256": "df8d9f36b79cdd5f2d940c0dc4bbc88acbb0bec6e66c9ee5ae93ad5c6e4ab89e"
            },
            {
              "path": "scripts/verify-material-inventory-postgres.mjs",
              "sha256": "c046f5bae2f922bcf83b3f2dffc53ad36f10a9dcc1e57bbd73923176d1bf8093"
            },
            {
              "path": "src/app/(identity)/cuenta/material-inventory-view.mjs",
              "sha256": "8942cb9a2f3ed071a77a9e87ca3876fa16b1f819bcb74f395e4307f7c167605a"
            },
            {
              "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
              "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
            },
            {
              "path": "src/lib/bindx-civil-data-client.mjs",
              "sha256": "20da64b82d14fb3d4055b9852ed8712d33b01d1bc9f50709cb55084c7d0433a2"
            },
            {
              "path": "src/lib/brand-assets.mjs",
              "sha256": "7da49f3f4d8c2f9d2cce36cc2902b5f46e044b98e67bace09e240f5b007fd4c1"
            },
            {
              "path": "src/lib/canonical-invited-account.mjs",
              "sha256": "94652997c4e6717e875041c859de9caaaeeabd9d166666d9dfbf899c51d98c7b"
            },
            {
              "path": "src/lib/company-channel-connection.mjs",
              "sha256": "f2c44860383bb49df67f7999fbe3c0a5aa57c91ebbde0cf9a3b5b367784f2c45"
            },
            {
              "path": "src/lib/company-channel-kyc.mjs",
              "sha256": "5b46276ad3aa5d656a0027be4a6bf58aa3fba4f557dd86e0c13d0d5b0cecba85"
            },
            {
              "path": "src/lib/company-channel-routing.mjs",
              "sha256": "9ed740dbb4ae1ca7d44171f176f0001d824b056a0f17a8f58ed1ea5a5a2e2f68"
            },
            {
              "path": "src/lib/company-channel-schema.mjs",
              "sha256": "96c0385fa3b6d60c8d1f92ca38dcdf32e7779f1200512806bf6d220e6be57022"
            },
            {
              "path": "src/lib/company-entitlement.mjs",
              "sha256": "65d41dfb796ef12be38b1220a99ccd3dfe277419a5e5a27e125beb29fe7e2cde"
            },
            {
              "path": "src/lib/company-onboarding-policy.mjs",
              "sha256": "cf557c7837d6264c78207028c668f8f8a2218f9632a8092cfcb8692ef11053d1"
            },
            {
              "path": "src/lib/company-phone-format.mjs",
              "sha256": "67b31114f517253961c6a774210f157867b1e2e318e6b700089eef03ef1b7209"
            },
            {
              "path": "src/lib/employee-intake-channel-continuity.mjs",
              "sha256": "59dffe3800f26cd979bd12c4cff0010ca72779e1dc62030a6f0117b6ef3fb64d"
            },
            {
              "path": "src/lib/field-hours-report.mjs",
              "sha256": "b55b767d61278bde31cb9ce4ef64faee5320fc7fe1b1bcc54559860bb4576731"
            },
            {
              "path": "src/lib/field-media-privacy.mjs",
              "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
            },
            {
              "path": "src/lib/field-media.mjs",
              "sha256": "d221ab87c4639aadb6eb8788a7203cee072f6eb1deca40605fc3d02742ab9d65"
            },
            {
              "path": "src/lib/field-operations-http.mjs",
              "sha256": "cd1773bc3b9fba01821cd4494b8559bdcdcc3a4ce886228622bb800349dcfd39"
            },
            {
              "path": "src/lib/field-operations-policy.mjs",
              "sha256": "bb33655b622a081de656f24c2e369fe7a2e05a0a0a9da7ffe455c2f39fd8fbd5"
            },
            {
              "path": "src/lib/field-operations-store.mjs",
              "sha256": "517267adb96c69bce58350b98b3a4e335ca1304a72a824e35998590e95b8987c"
            },
            {
              "path": "src/lib/field-overtime-policy.mjs",
              "sha256": "76848bd0861d6cecccb682b774599f03d3fe1322eed3cc58f5f1db5d9b1e24f8"
            },
            {
              "path": "src/lib/field-overtime-store.mjs",
              "sha256": "f29b67fff29949d5a8b14c4aed3f484ae1ce16d2ed42de486a6d5868361b1526"
            },
            {
              "path": "src/lib/field-report-feedback.mjs",
              "sha256": "70b966ae5f382abe6b5446daf1092c3f66b8f46f80ce5a0c006cffeba1cfa64c"
            },
            {
              "path": "src/lib/field-shift-summary.mjs",
              "sha256": "41f47aa7a0826ba1fe29b554c7575ec60c9861f0c18c863f06e8c3d00cb0f83c"
            },
            {
              "path": "src/lib/geo.js",
              "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
            },
            {
              "path": "src/lib/legacy-access-boundary.js",
              "sha256": "e1af7e83dac3c18bcf3b235d111d936d6dd6167925a3e1459d70a33913035370"
            },
            {
              "path": "src/lib/material-inventory.mjs",
              "sha256": "3af0b0e9c9003d09582ec4e8b21d1e35746dd3839fc7f01071935b9a4ea95333"
            },
            {
              "path": "src/lib/meta-callback-diagnostics.mjs",
              "sha256": "b16fcfbeabe02b119d0337485504490a0c8e60363e841e378ae4c7722816d3bc"
            },
            {
              "path": "src/lib/meta-channel-binding.mjs",
              "sha256": "0ba9e9de3b6dcca46524ab2df22236dbbcd5be5e6cef571df1ec47a01633672e"
            },
            {
              "path": "src/lib/meta-cloud-protocol.mjs",
              "sha256": "c6d5f1e1b4119dd2529860e3bd61a1b22d602f71ad301b2f04cec3ab4bbbed3c"
            },
            {
              "path": "src/lib/meta-consumption-evidence-catalog.mjs",
              "sha256": "cd4eb1ccf8617060aa2bb352cc9467981f7d17649be8b24233413c133c407bff"
            },
            {
              "path": "src/lib/meta-customer-app-projection.mjs",
              "sha256": "7b4b95712f143555a0e23b8ac98fc0e1d2f108e9fbefb4e861d20d9b464ef003"
            },
            {
              "path": "src/lib/meta-customer-callback.mjs",
              "sha256": "da90e3ed097c287a7c080d05daf5e4b0c0bb82544d2f7dab4cb1ee99880c3fd0"
            },
            {
              "path": "src/lib/meta-customer-coexistence.mjs",
              "sha256": "2cf704b2d3842d4ff7ae48a438c1271ad610ccf4e92a6214d97338e91e999c8e"
            },
            {
              "path": "src/lib/meta-customer-credentials.mjs",
              "sha256": "44a05a0b46417de835eb289882b0b2c6d71158f207c16c48228f1ac4b67cca0f"
            },
            {
              "path": "src/lib/meta-customer-inbox-review.mjs",
              "sha256": "250bd69c487dc8dffed5500c1ca0f9adb77843352902c41e4a63da7656bf2eaa"
            },
            {
              "path": "src/lib/meta-customer-outbound.mjs",
              "sha256": "84a249b3777d3be843b20b09d0c6cd81b6fab7415dc22f124477d87475eead09"
            },
            {
              "path": "src/lib/meta-customer-permissions.mjs",
              "sha256": "ce3671bd46af8e487c45319facbca8e6b522620fd16ee3163e5048b5ecb6585d"
            },
            {
              "path": "src/lib/meta-customer-processing.mjs",
              "sha256": "e4a52dbd2ce86793b66c4af5963c288b13d7b2b2f656c4c6f795bcac8074f4ad"
            },
            {
              "path": "src/lib/meta-customer-provider.mjs",
              "sha256": "102ae45ad7d0a1054d2c65cdbfa3a6a96accfcd982bebce8d6c32c7bf24b21a2"
            },
            {
              "path": "src/lib/meta-customer-templates.mjs",
              "sha256": "ca9e491b8b1b4c25c89585408cb53eae13e2423fdf48a93deed0846126e1c46c"
            },
            {
              "path": "src/lib/meta-development-pilot-policy.mjs",
              "sha256": "6f3a854898ea28d108341f35fe7f5f23facf3d574e586b96a2343a8038cc8c79"
            },
            {
              "path": "src/lib/meta-employee-intake.mjs",
              "sha256": "72e80601323adbe35c9ec1f61e49e3428007da55e567c724ca8dce3c42de042b"
            },
            {
              "path": "src/lib/meta-field-bridge.mjs",
              "sha256": "7f3bb80ba828e202f24e1d768b855131642dcc89fde39fcac4b81d64aa632955"
            },
            {
              "path": "src/lib/meta-field-conversation.mjs",
              "sha256": "c68887db8fa04f5806d1c0f4c29e829befb89931b8371041ad65334deb1dab4d"
            },
            {
              "path": "src/lib/meta-kyc-challenge.mjs",
              "sha256": "f5a03ec770e6d85de095393bf38c331c0803a7fe3c7f1b72a2addd9cac7484eb"
            },
            {
              "path": "src/lib/meta-kyc-conversation.mjs",
              "sha256": "17d1e52e826dcaa899e2e6b846e2856c73f73b18b7abfe30e951de0de8623ef6"
            },
            {
              "path": "src/lib/meta-kyc-current-image.mjs",
              "sha256": "03ef3966025f520b373e937a6230f846185f3b4845830da5a38c0d8f02e155c2"
            },
            {
              "path": "src/lib/meta-kyc-identity.mjs",
              "sha256": "295f87ecb3b4586313a4f9c48a2d5c9acf8fa263682d99d44a966be243af2319"
            },
            {
              "path": "src/lib/meta-kyc-rejection-policy.mjs",
              "sha256": "e6c96aba8077d75e152f45dc49fe32d41e103658d4bff4281c8c8a98e3fff0c1"
            },
            {
              "path": "src/lib/meta-kyc-rejection.mjs",
              "sha256": "5477adafd994a54c9e7bbcc196b6af4fbe0b9cc03ab563775b8258290e31f3d0"
            },
            {
              "path": "src/lib/meta-own-company-policy.mjs",
              "sha256": "7db3875cd0f31fec077f4d9a4f8875be1ddf4a5772acff4559069ae950ff0821"
            },
            {
              "path": "src/lib/meta-plan-import-conversation.mjs",
              "sha256": "6f3c261cb2cde943e0202ab5097d664958f5702975cdf5914aeac35e5a1bac1c"
            },
            {
              "path": "src/lib/meta-plan-import-origin.mjs",
              "sha256": "cdb619d1709a982323c9892383def1428db2ade771babdb18e4032b3535d953e"
            },
            {
              "path": "src/lib/meta-plan-import-transport.mjs",
              "sha256": "e42f48f0175dd697bac3de61d7d9893d35c2b1696c1ae276a4698eb3c36a4634"
            },
            {
              "path": "src/lib/meta-test-recipient-binding.mjs",
              "sha256": "2aea6f5815bd2d90fe891b45a79b48d339a3eebc681ac40b3347244e546c4b66"
            },
            {
              "path": "src/lib/meta-whatsapp-transport.mjs",
              "sha256": "f99569c7f587e9be1268aa254d2368226346a7ebf7e48fa6ca63a0064cf41310"
            },
            {
              "path": "src/lib/operations-status.mjs",
              "sha256": "ce05f2b18facdaa2df35274004ee2111be366056ef1ff2c593660b8490782cd6"
            },
            {
              "path": "src/lib/organization-resource-usage-policy.mjs",
              "sha256": "089ac1ee2ca6afd30aab1d0abd38274698ca56991d1c5225ea8e44c8b9fdc449"
            },
            {
              "path": "src/lib/organization-usage-policy.mjs",
              "sha256": "94997530d6c1fd420f0233172b07f8ba7dd7546a2ac9af75eaa30736400237ae"
            },
            {
              "path": "src/lib/participant-account-discovery.mjs",
              "sha256": "11b37ca397fdb195aac7addc1c16842fb28a9c83a73a82a57bf2791ed3038738"
            },
            {
              "path": "src/lib/participant-admission.mjs",
              "sha256": "2cbb466e49d742cd23da1bb85a4e89b7e411dc724c8d1f2eb66b39717f283dd9"
            },
            {
              "path": "src/lib/participant-analysis-consent.mjs",
              "sha256": "7f7d371914d1e46ac799cd1683afdc0418186c15a20156e697ecd879c81bf8c1"
            },
            {
              "path": "src/lib/participant-approved-identity.mjs",
              "sha256": "834d81e70cedbd967ff84d880ea9d697c2168d2220fb23d9eb14c1aba1cdbbf1"
            },
            {
              "path": "src/lib/participant-bank-account.mjs",
              "sha256": "29980527a6eda3bbc0125098a4b616082034a71fb1afb772ff87f476bc0ce981"
            },
            {
              "path": "src/lib/participant-bank-format.mjs",
              "sha256": "ebbb206a14eaac57230b53ec1afae99c4be60c8739baf0d1d047d4a47ba464db"
            },
            {
              "path": "src/lib/participant-bank-vault.mjs",
              "sha256": "06e990ab79c896628756f3c74a50dcc7e8062f4fa296f56a31e4150b5badc16a"
            },
            {
              "path": "src/lib/participant-channel-kyc.mjs",
              "sha256": "2ac9414429238162a9b16d4adea421df0bff9fb93ea4fbf2f9d6677f2659fb2d"
            },
            {
              "path": "src/lib/participant-civil-policy.mjs",
              "sha256": "e180a64c788d6cd20e766cb4fd32dbba1c7cb3954c01405ac8675ec023eef278"
            },
            {
              "path": "src/lib/participant-civil-store.mjs",
              "sha256": "5f440c0c76ca67b87a7e5d4e90e7a48f18ea3603b16434b35beeddd3bdf168a4"
            },
            {
              "path": "src/lib/participant-kyc-chat-attempt.mjs",
              "sha256": "d3f0a65f866fa027ee008963fcb6ffcad0cd33de94cace7603cf40bc78c21aeb"
            },
            {
              "path": "src/lib/participant-kyc-chat-closure.mjs",
              "sha256": "4a6a368910de95582c2baabc70bab7f4b4afa4413e8ebdb75a1e8b867c098a19"
            },
            {
              "path": "src/lib/participant-kyc-chat-copy.mjs",
              "sha256": "d886219584d5e8b9d9db1ad16a36c726f6982fa0e8400c3be51af2623574ab96"
            },
            {
              "path": "src/lib/participant-kyc-image-set.mjs",
              "sha256": "190ce2560286a58d42668da7b912aeabcfa76ee14086503bf1609304e5f0e8fb"
            },
            {
              "path": "src/lib/participant-kyc-notice-links.mjs",
              "sha256": "3547f3fc2ebdefc2522971467d4c77498160dde7806a25bf9fa18c527c8658fc"
            },
            {
              "path": "src/lib/participant-kyc-preanalysis-policy.mjs",
              "sha256": "8c5286a0a5d41364e92e60f2ce2ba96caccc8667960f966b5caead37acafab49"
            },
            {
              "path": "src/lib/participant-onboarding-authority.mjs",
              "sha256": "dad5d9fd0a61c493ff02331d5333982627cdeb3a7addb74a3c86d44da931f916"
            },
            {
              "path": "src/lib/participant-onboarding-current-kyc.mjs",
              "sha256": "232fecca4f6cf775e5151ec460560e0c1abd6646dc3c532140cabe26dfb42119"
            },
            {
              "path": "src/lib/participant-onboarding-delivery.mjs",
              "sha256": "615592cc1a6215e24c48e8873a27211421853f99ca9093e6f490f77532b3d013"
            },
            {
              "path": "src/lib/participant-onboarding-intent.mjs",
              "sha256": "07114f6066e10617357c4e5d8e2db2b9dc846e5f4cffbc5aef09f2b7bfada9de"
            },
            {
              "path": "src/lib/participant-onboarding-policy.mjs",
              "sha256": "59409797ce3e13b7cfe63fe21d8d7e2c848ee49e0766015939242a9f43687c03"
            },
            {
              "path": "src/lib/participant-onboarding-reactive.mjs",
              "sha256": "666a8c27f3ab7d6fdbe66c91f22ace4e25b04b98e865f401d19c72212916104d"
            },
            {
              "path": "src/lib/participant-policy.mjs",
              "sha256": "7f3969ab1ebac5f01696149d76337199eb64c2fd09015c44c07e8b7e7088d62f"
            },
            {
              "path": "src/lib/participant-store.mjs",
              "sha256": "2296495e366b9ea0c2511066584e93ddf1cff51b5eefd05c6121d2143d78f5c9"
            },
            {
              "path": "src/lib/participant-verified-office.mjs",
              "sha256": "4922f392490aa6d49b8a8a45a56ac0b03831a8ad2efe89ce1e3adfd77d603d89"
            },
            {
              "path": "src/lib/person-worksite-journey.mjs",
              "sha256": "d3174df793150125c0b6a5d9f37d56336e72cab1efb43a361065b78ac54c210a"
            },
            {
              "path": "src/lib/pilot-media.mjs",
              "sha256": "55e35757cea03c312df68cebad100ee8b7d904b418eca9082359ea34e68f8fa9"
            },
            {
              "path": "src/lib/plan-baseline-policy.mjs",
              "sha256": "e9217a41a87057f437439420d56f3b7a0f973ae37c250c07b335634fef308560"
            },
            {
              "path": "src/lib/plan-budget-source.mjs",
              "sha256": "7ebeabf62d8fb89c6ab941b8130d196ca2e008959a9599f2db0c71d75dd3382a"
            },
            {
              "path": "src/lib/plan-import-cyp-curve.mjs",
              "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
            },
            {
              "path": "src/lib/plan-import-document-curve.mjs",
              "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
            },
            {
              "path": "src/lib/plan-import-monthly-curve.mjs",
              "sha256": "6ce785f9c24c47f0e291b0bac40bd96a691fae68a309e4cb7a1917db31f9e6b6"
            },
            {
              "path": "src/lib/plan-import-ooxml.mjs",
              "sha256": "662abaa7523d74961c6873a8b0beb3eb7e3d3b52988fad9cc55e76c0e540a3bd"
            },
            {
              "path": "src/lib/plan-import-policy.mjs",
              "sha256": "1946b2793d0db11519d154acdb5bf0f7e8be5dc26ecd1971b846eed284d7d50f"
            },
            {
              "path": "src/lib/plan-import-store.mjs",
              "sha256": "da047723f790c0f5e7eeff855782e4db7463670d1875caf0bab1c6cce9b1a920"
            },
            {
              "path": "src/lib/plan-measurement-policy.mjs",
              "sha256": "3d6b0bce58a7f89612878310f534d8cf02f6a222c778cd4294b415c1f61157b7"
            },
            {
              "path": "src/lib/plan-measurement-source.mjs",
              "sha256": "ecf33b67a333d8ce73bfb51610218a1658cd94a26b62eb35d2290b795f826f36"
            },
            {
              "path": "src/lib/private-image-upload.mjs",
              "sha256": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60"
            },
            {
              "path": "src/lib/procurement-money.js",
              "sha256": "29dd0333ed5e2ade853ec2c0a8d0907792cdfaac83d347b46576544c16b9bd29"
            },
            {
              "path": "src/lib/procurement-quantity.js",
              "sha256": "53439844051cc1dbd679220d695e60e54bc1629b2f1ddb33fc125981da9326b3"
            },
            {
              "path": "src/lib/production-identity-config.mjs",
              "sha256": "3738a8544a7e26af4f03befe9afd0dee3ec70ae0e8c89d456dd81a1b87dfdee1"
            },
            {
              "path": "src/lib/progress-measurement-quantity.js",
              "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
            },
            {
              "path": "src/lib/site-purchase-policy.mjs",
              "sha256": "7a5532d2eebb05b8499a7e9d680f4a129f6d95f6dd7e9896fda858269cd25723"
            },
            {
              "path": "src/lib/site-purchase-store.mjs",
              "sha256": "f7c5f1f2244a8250d6b2daef07b6dd7c15ed1bda5cdee8ace9de8595dc0e2150"
            },
            {
              "path": "src/lib/site-register-policy.mjs",
              "sha256": "d529c4f2225e0ec851ef7df60f8c5b182a88b384958ebfd15b194683d1590434"
            },
            {
              "path": "src/lib/site-register-store.mjs",
              "sha256": "6b744c86f47dbb6dc081132675888615d76421701f96151b00646b5e1d2529c6"
            },
            {
              "path": "src/lib/task-progress-measurement.js",
              "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
            },
            {
              "path": "src/lib/video-audio-extractor.mjs",
              "sha256": "0c85dfd39c10fdb782eca4fe57dc665c29bd7211ab7aba0dda3f8945abcb1988"
            },
            {
              "path": "src/lib/video-frame-extractor.mjs",
              "sha256": "33425a184cf097884982c43a90e3b515726027adbeb51c2cdbfc794e79dee6e6"
            },
            {
              "path": "src/lib/voice-consumption-draft.mjs",
              "sha256": "b9af424825674ca6f24a729e9ba89bae6e67adf433de10837a05e58900584c82"
            },
            {
              "path": "src/lib/voice-progress-draft.mjs",
              "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
            },
            {
              "path": "src/lib/whatsapp/field-worker-intent-policy.js",
              "sha256": "0fdf205af1c2185a16f99c4f1aaba6c36d95722ea914915a0eefe6a10d443ef9"
            },
            {
              "path": "src/lib/whatsapp/obra-intent-policy.js",
              "sha256": "cd01054ba81be6552f58dc91758e08166ea099482f28355cae570d15f3ccf8da"
            },
            {
              "path": "src/lib/whatsapp/operational-proposal-decision-policy.js",
              "sha256": "996ed641c090267679ce0fc3cb7a23f39b31ce88e761135feb0dd0c852eb74fc"
            },
            {
              "path": "src/lib/whatsapp/project-workspace-profile.js",
              "sha256": "e13473baa4ca5b4dc9851bb202f400ba174ccbfce2589be65ce8458aafa998f4"
            },
            {
              "path": "src/lib/whatsapp/template-review-policy.js",
              "sha256": "0ec4a7e544f8c2c2409d2c84ecf69fab663334dd5a5cef0ee1b1cbec82de0a08"
            },
            {
              "path": "src/lib/whatsapp/tenant-workspace-policy.js",
              "sha256": "d3416ff993fbfd70f75404166cdcd8f0b9b2e5a6741f6cde03725aab16abcd5e"
            },
            {
              "path": "src/lib/worker-channel-consent-policy.mjs",
              "sha256": "95c8393e7f2603694c5c15cfe34c9eead43007927aed0d5b633859b14c7448a9"
            },
            {
              "path": "src/lib/worker-channel-identity.mjs",
              "sha256": "1cddd58a2cd656abaca25752481fe1ca760d2bcd385a0fffbe0e685c15d59e0a"
            },
            {
              "path": "src/lib/workspace-http.mjs",
              "sha256": "b4e56dcd8ecbbc40c9b5f7d0e610e6f16eeb69143d46397279044e69ca5b8429"
            },
            {
              "path": "src/lib/workspace-policy.mjs",
              "sha256": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e"
            },
            {
              "path": "src/lib/workspace-store.mjs",
              "sha256": "5f25092121a31a06eefa59d69866db82fa3cd28afdcbd0e066e52d916478bc50"
            },
            {
              "path": "tests/production-material-inventory-review-queue.test.mjs",
              "sha256": "22e981046a285a84ed2da2e5e187e006d4a503d9c3ae1852151f5644b23eac08"
            },
            {
              "path": "tests/production-material-inventory.test.mjs",
              "sha256": "2a80d93038308de209281839e8fdb1406d6ea99e2ff26f8c6c747b77506c2c61"
            }
          ]
        }
      }
    ],
    "nativeOrHumanAcceptance": false
  },
  "attendanceReviewRuntime": {
    "version": 1,
    "parentHead": "ad435c1ac3cd6bdb43ee6b51051c0ec2af312adb",
    "sourceAdditions": [
      "tests/production-field-attendance-review-query.test.mjs"
    ],
    "sourceSetAdvances": [
      {
        "family": "PG_FIELD",
        "previousDelta": {
          "family": "PG_FIELD",
          "contractPointer": "/extension/proofs/14/sourceFiles",
          "previousCount": 129,
          "previousPathsSha256": "32b4daffe18d479b78a644499d16034dc3f85442e5e84e4f7a2cc05c8b399c69",
          "currentCount": 132,
          "currentPathsSha256": "da275796b1e85d7228a4a11c56a497dca519bc588660ca25145b6e7520340a5a",
          "additions": [
            "src/lib/meta-consumption-evidence-catalog.mjs",
            "src/lib/plan-budget-source.mjs",
            "src/lib/voice-consumption-draft.mjs"
          ]
        },
        "additions": [
          "tests/production-field-attendance-review-query.test.mjs"
        ]
      }
    ],
    "producer": {
      "producer": "scripts/verify-field-operations-postgres.mjs",
      "previousSha256": "c3cf9eed8983b9ab43ad9b11cf0f59af206b08ba70f5e6697133bb448b940662",
      "currentSha256": "4eb11afda80e9274e3fecdc229d12f21d53d29d444e6932e44837f257800ccc2",
      "contractPointers": [
        "/extension/proofs/14/producerSha256"
      ],
      "sourceHistory": {
        "previousBytes": 164764,
        "currentBytes": 177609,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 1933,
            "currentText": " const admin=new Client({connectionString:url.toString()});let pool,created=false,proof;const checks=[],reviewPaginationChecks=[],voiceProgressChecks=[],mediaLeaseChecks=[],videoAudioChecks=[],canonicalOwnFieldChecks=[],attendanceReviewChecks=[];\n",
            "previousText": " const admin=new Client({connectionString:url.toString()});let pool,created=false,proof;const checks=[],reviewPaginationChecks=[],voiceProgressChecks=[],mediaLeaseChecks=[],videoAudioChecks=[],canonicalOwnFieldChecks=[];\n"
          },
          {
            "currentOffsetCharacters": 158943,
            "currentText": "  // New attendance review controls keep every historical ledger intact. The\n  // original pair is written through ATTENDANCE; bulk rows are explicit local\n  // query fixtures, never evidence of physical attendance or payable hours.\n  const attendanceAdaptersBefore={putCount,getCount,providerCalls};\n  const attendanceConfig=await operations.save(owner,reviewCommand(owner,'CONFIGURE_SITE',{revision:(await operations.read(owner,reviewContext(owner))).projectRevision,sectors:[{id:'review-attendance-sector',name:'Synthetic attendance review sector',latitude:0,longitude:0,radius:100}]}));\n  assert.equal(attendanceConfig.qrTokens.length,1);\n  const attendanceReviewCommand=(eventType,expectedEventId)=>reviewCommand(worker,'ATTENDANCE',{workerId:'wr-a',eventType,expectedEventId,sectorId:'review-attendance-sector',qrToken:null,location:{latitude:0,longitude:0,accuracy:5,capturedAt:new Date().toISOString(),noticeVersion:'field-location-v1'}});\n  // The historical lost-COMMIT case intentionally left this person's p-a journey open. Keep that guard, then close through the existing canonical transition before moving sites.\n  const secondSiteDeniedBefore=await ownFieldState();await assert.rejects(operations.save(worker,attendanceReviewCommand('CHECK_IN',null)),{code:'ATTENDANCE_PERSON_JOURNEY_OPEN',status:409});assert.deepEqual(await ownFieldState(),secondSiteDeniedBefore);\n  const primaryBeforeTransfer=await read(worker),primaryHead=primaryBeforeTransfer.selfAttendanceHeads.find(row=>row.workerId==='w-a'),primarySector=primaryBeforeTransfer.sectors.find(row=>row.id==='sector-main');assert.equal(primaryHead.status,'CURRENT');assert.equal(primaryHead.head.eventType,'CHECK_IN');assert.equal(primaryHead.head.id,last.id);assert.ok(primarySector);assert.equal(primarySector.latitude,0);assert.equal(primarySector.longitude,0);\n  const closePrimaryInput=attendance(worker,'CHECK_OUT',primaryHead.head.id,{sectorId:primarySector.id,qrToken:null}),primaryClosed=await operations.save(worker,closePrimaryInput);assert.equal(primaryClosed.event.eventType,'CHECK_OUT');assert.equal((await read(worker)).selfAttendanceHeads.find(row=>row.workerId==='w-a').head.id,primaryClosed.event.id);assert.equal((await operations.save(worker,closePrimaryInput)).replayed,true);\n  const oldAttendanceEntry=(await operations.save(worker,attendanceReviewCommand('CHECK_IN',null))).event;\n  const oldAttendanceExit=(await operations.save(worker,attendanceReviewCommand('CHECK_OUT',oldAttendanceEntry.id))).event;\n  for(const event of [oldAttendanceEntry,oldAttendanceExit])assert.equal(event.verificationStatus,'REVIEW_REQUIRED');\n  await pool.query(`INSERT INTO \"AttendanceEntry\"(id,\"projectId\",\"workerId\",status,source,\"checkedInAt\",metadata) SELECT 'attendance-resolved-'||lpad(n::text,4,'0'),\"projectId\",\"workerId\",status,source,'2099-01-01 00:00:00.123456',jsonb_set(metadata,'{fieldOperations,review}',$2::jsonb) FROM \"AttendanceEntry\" CROSS JOIN generate_series(1,101) AS n WHERE id=$1`,[oldAttendanceExit.id,JSON.stringify({decision:'APPROVE',reason:'Synthetic resolved query fixture only',actorId:'owner',recordedAt:'2099-01-01T00:00:01.000Z'})]);\n  const attendanceReviewInput=(s,filter='PENDING',extra={})=>({...reviewContext(s),reviewSection:'ATTENDANCE',reviewFilter:filter,...extra});\n  const attendancePage=(s,filter='PENDING',extra={})=>operations.reviewPage(s,attendanceReviewInput(s,filter,extra));\n  const oldAttendancePage=await attendancePage(director),oldAttendanceBase=await operations.read(director,reviewContext(director));\n  assert.equal(oldAttendanceBase.attendance.some(row=>row.id===oldAttendanceEntry.id),false);\n  assert.deepEqual(oldAttendancePage.records.map(row=>row.id),[oldAttendanceExit.id,oldAttendanceEntry.id]);assert.equal(oldAttendancePage.total,2);assert.equal(oldAttendancePage.nextCursor,null);\n  assert.ok(oldAttendancePage.records.every(row=>row.workerName==='wr-a'));\n  for(const reviewer of [owner,director,manager]){const page=await attendancePage(reviewer);assert.equal(page.canReview,true);assert.ok(page.records.some(row=>row.id===oldAttendanceEntry.id));}\n  await pool.query(`INSERT INTO \"Worker\"(id,\"projectId\",name,phone,role,metadata,\"updatedAt\") SELECT 'aa-attendance-display-'||lpad(n::text,4,'0'),'p-review','Synthetic display row without account','synthetic-no-contact-'||n,'WORKER','{}',clock_timestamp() FROM generate_series(1,101) AS n`);\n  try{\n    assert.equal((await operations.read(director,reviewContext(director))).workers.some(row=>row.id==='wr-a'),false);\n    assert.deepEqual((await attendancePage(director)).records.map(row=>[row.id,row.workerName]),oldAttendancePage.records.map(row=>[row.id,row.workerName]));\n  }finally{await pool.query(`DELETE FROM \"Worker\" WHERE \"projectId\"='p-review' AND id=ANY($1::text[])`,[Array.from({length:101},(_,n)=>'aa-attendance-display-'+String(n+1).padStart(4,'0'))]);}\n  attendanceReviewChecks.push('attendance-pending-older-than-101-resolved-events-is-complete-and-reviewable-for-current-authorized-roles-with-same-query-worker-names');\n\n  await pool.query(`INSERT INTO \"AttendanceEntry\"(id,\"projectId\",\"workerId\",status,source,\"checkedInAt\",metadata) SELECT 'attendance-pending-'||lpad(n::text,4,'0'),\"projectId\",\"workerId\",status,source,'2099-02-01 00:00:00.123456',metadata FROM \"AttendanceEntry\" CROSS JOIN generate_series(1,201) AS n WHERE id=$1`,[oldAttendanceExit.id]);\n  const attendanceState=async()=>(await pool.query(`SELECT (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM \"AttendanceEntry\" a WHERE \"projectId\"='p-review') AS attendance,(SELECT count(*)::int FROM \"AuditLog\") AS audits,(SELECT to_jsonb(p) FROM \"Project\" p WHERE id='p-review') AS project,(SELECT to_jsonb(t) FROM \"Task\" t WHERE id='task-review') AS task`)).rows;\n  const beforeAttendanceReads=await attendanceState(),attendanceSql=[];\n  const countedAttendanceWorkspace=createWorkspaceStore({connect:async()=>{const c=await pool.connect();return {release:bad=>c.release(bad),query:(sql,args)=>{if(sql.includes('public.\"AttendanceEntry\"'))attendanceSql.push(sql);return c.query(sql,args);}};}});\n  const firstAttendancePage=await createFieldOperations({workspace:countedAttendanceWorkspace}).reviewPage(director,attendanceReviewInput(director));\n  assert.equal(attendanceSql.length,2);assert.equal(attendanceSql.filter(sql=>sql.includes('LEFT JOIN public.\"Worker\"')).length,1);assert.equal(firstAttendancePage.records.length,100);assert.equal(firstAttendancePage.total,203);\n  const expectedAttendanceIds=[...Array.from({length:201},(_,n)=>'attendance-pending-'+String(n+1).padStart(4,'0')).reverse(),oldAttendanceExit.id,oldAttendanceEntry.id];\n  const receivedAttendanceIds=[];let attendanceCursor=null,attendanceStamp=null,attendancePages=0;\n  do{const page=await attendancePage(director,'PENDING',attendanceCursor?{afterReview:attendanceCursor,reviewAccessStamp:attendanceStamp}:{});assert.equal(page.total,203);assert.ok(page.records.length<=100);assert.ok(page.records.every(row=>row.verificationStatus==='REVIEW_REQUIRED'&&row.review===null));receivedAttendanceIds.push(...page.records.map(row=>row.id));attendanceCursor=page.nextCursor;attendanceStamp=page.reviewAccessStamp;attendancePages++;}while(attendanceCursor);\n  assert.equal(attendancePages,3);assert.deepEqual(receivedAttendanceIds,expectedAttendanceIds);assert.equal(new Set(receivedAttendanceIds).size,203);\n  const directedAttendance=await attendancePage(director,'ALL',{reviewId:oldAttendanceEntry.id,reviewAccessStamp:attendanceStamp});assert.equal(directedAttendance.total,1);assert.equal(directedAttendance.nextCursor,null);assert.deepEqual(directedAttendance.records.map(row=>row.id),[oldAttendanceEntry.id]);\n  const allAttendance=await attendancePage(director,'ALL');assert.equal(allAttendance.total,304);assert.equal(allAttendance.records.length,100);assert.equal(allAttendance.nextCursor,allAttendance.records.at(-1).id);assert.deepEqual(await attendanceState(),beforeAttendanceReads);\n  attendanceReviewChecks.push('attendance-203-pending-keyset-pages-preserve-equal-microsecond-order-exact-total-directed-old-row-and-readonly-two-query-joined-names-without-N-plus-one');\n\n  const ownedAttendance=await attendancePage(worker);assert.equal(ownedAttendance.canReview,false);assert.equal(ownedAttendance.total,203);\n  assert.deepEqual((await attendancePage(otherWorker)).records,[]);\n  await pool.query(`UPDATE \"AttendanceEntry\" SET metadata=jsonb_set(metadata,'{fieldOperations,recordedBy}','\"worker2\"') WHERE id='attendance-pending-0201'`);\n  try{\n    assert.equal((await attendancePage(worker)).total,202);\n    for(const selector of ['afterReview','reviewId'])await assert.rejects(attendancePage(worker,selector==='reviewId'?'ALL':'PENDING',{[selector]:'attendance-pending-0201',reviewAccessStamp:ownedAttendance.reviewAccessStamp}),{code:'FIELD_REVIEW_CURSOR_UNAVAILABLE',status:404});\n    assert.equal((await attendancePage(director,'ALL',{reviewId:'attendance-pending-0201',reviewAccessStamp:attendanceStamp})).records.length,1);\n  }finally{await pool.query(`UPDATE \"AttendanceEntry\" SET metadata=jsonb_set(metadata,'{fieldOperations,recordedBy}','\"worker\"') WHERE id='attendance-pending-0201'`);}\n  for(const selector of ['afterReview','reviewId'])for(const id of [exit.event.id,'unknown-attendance'])await assert.rejects(attendancePage(director,selector==='reviewId'?'ALL':'PENDING',{[selector]:id,reviewAccessStamp:attendanceStamp}),{code:'FIELD_REVIEW_CURSOR_UNAVAILABLE',status:404});\n  await assert.rejects(operations.reviewPage(foreign,attendanceReviewInput(foreign)),{code:'WORKSPACE_PROJECT_UNAVAILABLE',status:404});\n  await assert.rejects(operations.reviewPage(worker,{...attendanceReviewInput(worker),scope:scopes[director.userId]}),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});\n  const ownAttendanceMetadata=(await pool.query(`SELECT metadata FROM \"Worker\" WHERE id='wr-a'`)).rows[0].metadata;\n  try{\n    await pool.query(`UPDATE \"Worker\" SET metadata=jsonb_set(metadata,'{participant,permissions,attendance}','false') WHERE id='wr-a'`);\n    await assert.rejects(attendancePage(worker,'PENDING',{afterReview:oldAttendanceEntry.id,reviewAccessStamp:ownedAttendance.reviewAccessStamp}),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});\n    assert.equal((await attendancePage(worker)).total,0);\n  }finally{await pool.query(`UPDATE \"Worker\" SET metadata=$1::jsonb WHERE id='wr-a'`,[JSON.stringify(ownAttendanceMetadata)]);}\n  try{await pool.query(`UPDATE \"TenantMembership\" SET status='REVOKED' WHERE id='director-m'`);await assert.rejects(attendancePage(director),{code:'WORKSPACE_MEMBERSHIP_REQUIRED',status:403});}finally{await pool.query(`UPDATE \"TenantMembership\" SET status='ACTIVE' WHERE id='director-m'`);}\n  assert.deepEqual(await attendanceState(),beforeAttendanceReads);\n  attendanceReviewChecks.push('attendance-review-current-tenant-project-role-author-and-field-permission-scope-revocation-denials-never-write-ledger-or-receipts');\n\n  const attendanceDecision=reviewCommand(director,'REVIEW_ATTENDANCE',{eventId:oldAttendanceEntry.id,decision:'APPROVE',reason:'Synthetic independent review of old canonical attendance.'});\n  await assert.rejects(operations.save(worker,{...attendanceDecision,...reviewContext(worker),operationId:randomUUID()}),{code:'FIELD_PERMISSION_REQUIRED',status:403});\n  const attendanceDecisions=await Promise.all([operations.save(director,attendanceDecision),operations.save(director,attendanceDecision)]);assert.equal(attendanceDecisions.filter(row=>!row.replayed).length,1);\n  const attendanceReadback=await attendancePage(director,'ALL',{reviewId:oldAttendanceEntry.id,reviewAccessStamp:attendanceStamp});assert.equal(attendanceReadback.records[0].review.decision,'APPROVE');\n  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM \"AuditLog\" WHERE metadata->>'command'='REVIEW_ATTENDANCE' AND metadata->'outcome'->'event'->>'id'=$1`,[oldAttendanceEntry.id])).rows[0].n,1);\n  assert.equal((await attendancePage(director)).total,202);assert.deepEqual((await attendancePage(director,'PENDING',{afterReview:oldAttendanceEntry.id,reviewAccessStamp:attendanceStamp})).records,[]);\n  const afterAttendanceDecision=await attendanceState();await assert.rejects(operations.save(director,{...attendanceDecision,operationId:randomUUID()}),{code:'FIELD_ALREADY_REVIEWED',status:409});assert.deepEqual(await attendanceState(),afterAttendanceDecision);\n  assert.deepEqual({putCount,getCount,providerCalls},attendanceAdaptersBefore);\n  attendanceReviewChecks.push('attendance-old-row-decision-is-independent-current-authorized-atomic-once-under-replay-and-remains-a-usable-cursor-after-review');\n  assert.equal(attendanceReviewChecks.length,4);\n  const databaseEngineVersion=(await pool.query('SHOW server_version')).rows[0].server_version;\n const sourceFiles=['src/lib/workspace-store.mjs','src/lib/workspace-policy.mjs','src/lib/field-operations-store.mjs','src/lib/field-operations-policy.mjs','src/lib/field-operations-http.mjs','src/app/api/identity/field-operations/route.js','src/app/(identity)/cuenta/field-review-page-view.mjs','src/app/(identity)/cuenta/field-operations-panel.js','tests/production-field-review-pagination.test.mjs','tests/production-field-attendance-review-query.test.mjs','tests/production-field-canonical-kyc.test.mjs','scripts/verify-field-operations-postgres.mjs','scripts/verify-field-operations-ui.mjs','vercel.json'];\n",
            "previousText": " const databaseEngineVersion=(await pool.query('SHOW server_version')).rows[0].server_version;\n const sourceFiles=['src/lib/workspace-store.mjs','src/lib/workspace-policy.mjs','src/lib/field-operations-store.mjs','src/lib/field-operations-policy.mjs','src/lib/field-operations-http.mjs','src/app/api/identity/field-operations/route.js','src/app/(identity)/cuenta/field-review-page-view.mjs','src/app/(identity)/cuenta/field-operations-panel.js','tests/production-field-review-pagination.test.mjs','tests/production-field-canonical-kyc.test.mjs','scripts/verify-field-operations-postgres.mjs','scripts/verify-field-operations-ui.mjs','vercel.json'];\n"
          },
          {
            "currentOffsetCharacters": 175168,
            "currentText": " proof={status:'PASS',harnessSha256,participantKycFixture:{sourceSha256:fixtureSourceSha256,records:kycFixture.records,syntheticPrivateCalls:kycFixture.calls,providerCalls:0,biometricIdentityCertified:false},environment:'disposable-local-postgresql'+databaseEngineVersion.split('.')[0],databaseEngineVersion,checks,reviewPaginationChecks,voiceProgressChecks,checkCount:checks.length,reviewPaginationCheckCount:reviewPaginationChecks.length,voiceProgressCheckCount:voiceProgressChecks.length,totalChecks:checks.length+reviewPaginationChecks.length+voiceProgressChecks.length+mediaLeaseChecks.length+videoAudioChecks.length+canonicalOwnFieldChecks.length+ownHistoryPrivacyChecks.length+attendanceReviewChecks.length,attendanceReviewChecks,attendanceReviewCheckCount:attendanceReviewChecks.length,canonicalOwnFieldChecks,canonicalOwnFieldCheckCount:canonicalOwnFieldChecks.length,ownHistoryPrivacy,sourceSha256,voiceProgressSourceSha256,mediaLeaseChecks,mediaLeaseCheckCount:mediaLeaseChecks.length,mediaLeaseSourceSha256,mediaLeaseSyntheticAdapterCalls,mediaLeaseFinalSqlBoundary,mediaLeaseClockBiasMs:[-86400000,86400000],mediaLeaseProviderCalls:0,mediaLeaseAdapters:{storage:'synthetic-private-objects',decoder:'synthetic-video-decoder-double-no-codec-acceptance',provider:'synthetic-responses',database:'real-disposable-postgresql'},videoAudioChecks,videoAudioCheckCount:videoAudioChecks.length,videoAudioSourceSha256,videoAudioSyntheticAdapterCalls,videoAudioBoundaryObservations,videoAudioProviderCalls:0,videoAudioFfmpegExecuted:false,videoAudioAdapters:{storage:'synthetic-private-objects-original-only',frameDecoder:'synthetic-frame-response-no-codec-acceptance',audioDecoder:'synthetic-canonical-pcm-and-metadata-no-codec-acceptance',provider:'synthetic-responses',database:'real-disposable-postgresql'},productionDataWritten:false,providerCalls:0,reviewPaginationProviderCalls:0,voiceProgressProviderCalls:0,voiceProgressSyntheticAdapterCalls:voiceAdapterCalls,mediaAdapters:'synthetic-isolated-objects-and-responses',physicalAttendanceAccepted:false,whatsAppTested:false};\n",
            "previousText": " proof={status:'PASS',harnessSha256,participantKycFixture:{sourceSha256:fixtureSourceSha256,records:kycFixture.records,syntheticPrivateCalls:kycFixture.calls,providerCalls:0,biometricIdentityCertified:false},environment:'disposable-local-postgresql'+databaseEngineVersion.split('.')[0],databaseEngineVersion,checks,reviewPaginationChecks,voiceProgressChecks,checkCount:checks.length,reviewPaginationCheckCount:reviewPaginationChecks.length,voiceProgressCheckCount:voiceProgressChecks.length,totalChecks:checks.length+reviewPaginationChecks.length+voiceProgressChecks.length+mediaLeaseChecks.length+videoAudioChecks.length+canonicalOwnFieldChecks.length+ownHistoryPrivacyChecks.length,canonicalOwnFieldChecks,canonicalOwnFieldCheckCount:canonicalOwnFieldChecks.length,ownHistoryPrivacy,sourceSha256,voiceProgressSourceSha256,mediaLeaseChecks,mediaLeaseCheckCount:mediaLeaseChecks.length,mediaLeaseSourceSha256,mediaLeaseSyntheticAdapterCalls,mediaLeaseFinalSqlBoundary,mediaLeaseClockBiasMs:[-86400000,86400000],mediaLeaseProviderCalls:0,mediaLeaseAdapters:{storage:'synthetic-private-objects',decoder:'synthetic-video-decoder-double-no-codec-acceptance',provider:'synthetic-responses',database:'real-disposable-postgresql'},videoAudioChecks,videoAudioCheckCount:videoAudioChecks.length,videoAudioSourceSha256,videoAudioSyntheticAdapterCalls,videoAudioBoundaryObservations,videoAudioProviderCalls:0,videoAudioFfmpegExecuted:false,videoAudioAdapters:{storage:'synthetic-private-objects-original-only',frameDecoder:'synthetic-frame-response-no-codec-acceptance',audioDecoder:'synthetic-canonical-pcm-and-metadata-no-codec-acceptance',provider:'synthetic-responses',database:'real-disposable-postgresql'},productionDataWritten:false,providerCalls:0,reviewPaginationProviderCalls:0,voiceProgressProviderCalls:0,voiceProgressSyntheticAdapterCalls:voiceAdapterCalls,mediaAdapters:'synthetic-isolated-objects-and-responses',physicalAttendanceAccepted:false,whatsAppTested:false};\n"
          }
        ]
      }
    },
    "nativeOrHumanAcceptance": false
  }
});
