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
      "currentSha256": "9522f2d4b0c04c51b02491f0aac1c16ff9b8585568c00322045a2c8724b000cc"
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
      "path": "scripts/lib/home-decisions-current-ci-lineage.mjs",
      "previousSha256": "0f7f9ac5f194ece14a65c5a1ca80ada1bb695be26766a9fbe7fbdc19efc0be6f",
      "currentSha256": "ae44e43ec0202bffc3c729219fe9fdb6066363a970279f62cc4438d5d715ead5"
    },
    {
      "path": "scripts/lib/material-review-current-ci-lineage.mjs",
      "previousSha256": "805e35504f147f017b4e70889c29c92175a4673f03916630319f6f25d040c4b4",
      "currentSha256": "9155e03f6c6831e8122263b73c16a724645fc5cd3ebcfdd950c0413543c12a64"
    },
    {
      "path": "scripts/lib/plan-budget-browser-ui.mjs",
      "previousSha256": null,
      "currentSha256": "67ca623eef0518314e53f7a92ec19f818f698b620f0e22833a27593e5a08f5a1"
    },
    {
      "path": "scripts/lib/plan-budget-current-ci-lineage.mjs",
      "previousSha256": null,
      "currentSha256": "57864fdf5e3ca44dbcb02c98b06f645300527b8d1b1b689928f7f8aa53e476db"
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
      "path": "scripts/verify-meta-customer-coexistence-postgres.mjs",
      "previousSha256": "fd94401af9a07866a2cd28a355b7f2f69ef122cf3ae325690c8ffc35cb97092a",
      "currentSha256": "463875f2b3a12df09847a2de5dcd2b3b87e0df7a043303ca76bb754266c7929f"
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
      "path": "src/app/(identity)/cuenta/field-media-preview.js",
      "previousSha256": "d39d47da18f60c69a38eee22b62929087a7cc0b379a620af8a83b62573161110",
      "currentSha256": "61506157217af690aa3ea649a2472f99acc24ec96aa10eda3cc25d24a8108441"
    },
    {
      "path": "src/app/(identity)/cuenta/field-operations-panel.js",
      "previousSha256": "69af7d8b95378f0b7f26f880eaec61d891c38744e9e6781eca9fe539776a91ed",
      "currentSha256": "197fa68dacf6ad8adee77f55370363e1bdba63f442d7a7196c96ae95b8829fe7"
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
      "path": "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
      "previousSha256": "060e128b54eefdadfbabac45c3ec696934f5e74d79b9e26e905081128e8e99c5",
      "currentSha256": "3a8d1c517fb084df425198c84671f6b76bb1f659f9d0d4ed94945cd1046d8e64"
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
      "currentSha256": "d3dffce08238141f672a8af0c1b956da15809e18608084b9bdf57d50ae166ceb"
    },
    {
      "path": "src/lib/field-operations-policy.mjs",
      "previousSha256": "01eb863d7db4446eeb8dab990d7e0602a19d581d5615a0b1e5d50c02f3d70173",
      "currentSha256": "bb33655b622a081de656f24c2e369fe7a2e05a0a0a9da7ffe455c2f39fd8fbd5"
    },
    {
      "path": "src/lib/field-operations-store.mjs",
      "previousSha256": "dbf96641349efae61808a2d66a02d491ad06e2226885e6efa928dba53ce5034e",
      "currentSha256": "8f54edfb613fcf90f099015d42c89e993e5d3ca74f5bd11e9743830324547604"
    },
    {
      "path": "src/lib/material-inventory.mjs",
      "previousSha256": "4b599d273c4cadcdf76202554757583152da8c11b0a754be386bffb830f0c65b",
      "currentSha256": "3af0b0e9c9003d09582ec4e8b21d1e35746dd3839fc7f01071935b9a4ea95333"
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
      "path": "src/lib/meta-kyc-conversation.mjs",
      "previousSha256": "75870a6359385ae83df0d154b57c3f6738f2bde62fbe4974da7e38e5b0de2902",
      "currentSha256": "2ba67025781ab2f6cd629ec3643060c4ab04b2b8fd7cd50ac87c6973c6d083f5"
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
      "path": "tests/production-field-outbound-current-ci-lineage.test.mjs",
      "previousSha256": "ca1f7fa23d0247aa994693eeec90ae019c20408e6e97ea9496507904cd8bc631",
      "currentSha256": "0182c754008d2aa1e507dcdf7d2a5d9a47c348553e0d947453bac4e0c9e5914a"
    },
    {
      "path": "tests/production-home-decisions-current-ci-lineage.test.mjs",
      "previousSha256": "511f6c45d33d66a22a7f583fd48c7ea7d4933dab26473d2106ece15056e4f6c7",
      "currentSha256": "87c929ffdf3db12ad636bf27fcf7091edb9e0fbf1003210d6ac2450967ffe031"
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
      "currentSha256": "cd3f36d1a26c2b2c82a27537566b9221245a6747012bf9e641fc8c0d73ea565e"
    },
    {
      "path": "tests/production-meta-existing-api-plan-current-ci-lineage.test.mjs",
      "previousSha256": "dabe6caf8e2a216aa1d7160551431ce3e3b198b09b397f8c10edfeb9d9928650",
      "currentSha256": "00d21d855c36f8020bd1791ed3b48b90901f7e017c0611d2df33a3a13ab1978d"
    },
    {
      "path": "tests/production-ooxml-accounting-current-ci-lineage.test.mjs",
      "previousSha256": "35a12ce84a67245d0c96a059c741c8eff29711d71896be1774b88c76e975be55",
      "currentSha256": "4128c77d310d613cfa22f7480bd00ca041686507fb3619aafe941419144bdb86"
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
      "currentSha256": "16d48fb4c4f787ddc3fad0e6894d0dff38b95cd75f58d614110354d2758e982e"
    },
    {
      "path": "src/app/(identity)/cuenta/company-subscription-panel.js",
      "previousSha256": "0b208fdcbea4900bd6adf86ad80f8524b5afa647d78a24fbf5731d3d7d79c749",
      "currentSha256": "b439d95c9e48f4b0ef83bd6ca93efac56dc059a8b50b508475d9d5e29af4b6dc"
    },
    {
      "path": "src/app/(identity)/cuenta/company-subscription-panel.module.css",
      "previousSha256": "fdede43a09f48b011f7e3cb184ea16bf0be0e98069e7a953b71b8e391b3dfa3e",
      "currentSha256": "678a18a7ad87f8312a7ad9e8267709297653e7572ea4b537ac42b6959b3a523a"
    }
  ],
  "sourceSetDeltas": [
    {
      "family": "UNIT",
      "contractPointer": "/extension/proofs/0/sourceFiles",
      "previousCount": 140,
      "previousPathsSha256": "7104df28ae9391e6038819dee38a1ee1c8b40806a229ed63324943da39ced460",
      "currentCount": 141,
      "currentPathsSha256": "7003e831534130168d05e652d89f98b535462e1c8d093e5f65e7db3403501daa",
      "additions": [
        "src/lib/plan-budget-source.mjs"
      ]
    },
    {
      "family": "UI_BANK",
      "contractPointer": "/extension/proofs/3/sourceFiles",
      "previousCount": 144,
      "previousPathsSha256": "e581ca81d4ea63b3573d296b1fea9b318c738df99657657526f94317d8b9fed2",
      "currentCount": 145,
      "currentPathsSha256": "46244d8547a8eb7242a41a58b9615ee4100e9f1e14b85231f62efabf18e11cec",
      "additions": [
        "src/lib/plan-budget-source.mjs"
      ]
    },
    {
      "family": "UI_JOINT",
      "contractPointer": "/extension/proofs/5/sourceFiles",
      "previousCount": 143,
      "previousPathsSha256": "3c7e4b0e5ccbd4d8488e0ba0ad75ccbabe8b683670eed3482e096d7b33cc7e32",
      "currentCount": 144,
      "currentPathsSha256": "5b94dccebc72186728ce946d71061eae8e587f3fecdedf90af86aa3ed08ec025",
      "additions": [
        "src/lib/plan-budget-source.mjs"
      ]
    },
    {
      "family": "UI_CAUSAL",
      "contractPointer": "/extension/proofs/6/sourceFiles",
      "previousCount": 143,
      "previousPathsSha256": "3c7e4b0e5ccbd4d8488e0ba0ad75ccbabe8b683670eed3482e096d7b33cc7e32",
      "currentCount": 144,
      "currentPathsSha256": "5b94dccebc72186728ce946d71061eae8e587f3fecdedf90af86aa3ed08ec025",
      "additions": [
        "src/lib/plan-budget-source.mjs"
      ]
    },
    {
      "family": "PG_COMPANY_KYC",
      "contractPointer": "/extension/proofs/7/sourceFiles",
      "previousCount": 237,
      "previousPathsSha256": "649f11c2b82a4cfe38090cf6e1adcd1394a9cc719bf1c485bd3cd67a88f2c858",
      "currentCount": 238,
      "currentPathsSha256": "e1a319ae756ba2e85cbd5a5618b0e9777795433ab2ee5e018d0808003ab6b3bd",
      "additions": [
        "src/lib/plan-budget-source.mjs"
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
      "currentCount": 130,
      "currentPathsSha256": "d36caf3d5139df02c67a5854a4844d4a8f3bc5a1c5f9446659ee82575acad373",
      "additions": [
        "src/lib/plan-budget-source.mjs"
      ]
    },
    {
      "family": "PG_OVERTIME",
      "contractPointer": "/extension/proofs/15/sourceFiles",
      "previousCount": 114,
      "previousPathsSha256": "19f1a9094ddee24870d3f3e2cd963b34fd85def12472e797cabef3af9aac64b5",
      "currentCount": 115,
      "currentPathsSha256": "52b21658a3b32e348bb4fabd274b79af708e8da384fae38667526709dae78db9",
      "additions": [
        "src/lib/plan-budget-source.mjs"
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
      "currentCount": 246,
      "currentPathsSha256": "10356efa3e8820a28587f31d94f087d294e40d9a4efc791f4512379e1d82f34f",
      "additions": [
        "scripts/lib/plan-budget-current-ci-lineage.mjs",
        "scripts/lib/plan-budget-current-ci-reviewed.mjs",
        "src/lib/plan-budget-source.mjs"
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
      "currentCount": 120,
      "currentPathsSha256": "1cf2d31c41ec00e88cb3c628788c21a80b482b1a71a1d298301a8427b8d0f224",
      "additions": [
        "src/lib/plan-budget-source.mjs"
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
      "currentCount": 117,
      "currentPathsSha256": "71259eec664a644d6eb0ed727b4980c71677104d31d58cef7c828caf85c16ce6",
      "additions": [
        "src/lib/plan-budget-source.mjs"
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
      "currentCount": 141,
      "currentPathsSha256": "78ace2186e2a52f6a789ee8b51319080b5171420e465b4a63c03d52c5d0d294f",
      "additions": [
        "src/lib/plan-budget-source.mjs"
      ]
    },
    {
      "family": "ORGANIZATION_USAGE",
      "contractPointer": null,
      "previousCount": 121,
      "previousPathsSha256": "61c6ff93f2afbcd4d561e3e635927c240ac09100ee79616901ddbd24fb60010b",
      "currentCount": 122,
      "currentPathsSha256": "a74d151d097a409a819e5c25f414faa649bb71cc6f214064fee64e5e92bab48a",
      "additions": [
        "src/lib/plan-budget-source.mjs"
      ]
    },
    {
      "family": "KYC_REPLY_FEEDBACK",
      "contractPointer": null,
      "previousCount": 117,
      "previousPathsSha256": "c065cec9a54b9acb73f0cd9b84517326f9686222f7609c0401ad4b7b6bbb6f7c",
      "currentCount": 118,
      "currentPathsSha256": "ae5d7f5332120838562119040901d8d3b09f3e18e649eaa0cb79a6cf583cc685",
      "additions": [
        "src/lib/plan-budget-source.mjs"
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
        "src/app/(identity)/cuenta/kyc-camera-session.mjs",
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
        "src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs",
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
          "sha256": "b439d95c9e48f4b0ef83bd6ca93efac56dc059a8b50b508475d9d5e29af4b6dc"
        },
        {
          "path": "src/app/(identity)/cuenta/company-subscription-panel.module.css",
          "sha256": "678a18a7ad87f8312a7ad9e8267709297653e7572ea4b537ac42b6959b3a523a"
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
          "sha256": "197fa68dacf6ad8adee77f55370363e1bdba63f442d7a7196c96ae95b8829fe7"
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
          "sha256": "18f3616144c03aacf9c9859ae210150d92f6838de7332cee2550fa5fe91603fb"
        },
        {
          "path": "src/app/(identity)/cuenta/kyc-camera-session.mjs",
          "sha256": "e84404979093aaad5179cf47433b3930ddc71e7677fe36db6018fcd49bf8e5c4"
        },
        {
          "path": "src/app/(identity)/cuenta/kyc-photo-preparation.js",
          "sha256": "d88c55b9fb97b6b1abb5ecb02cf66b9d8e016821525f1b6a3cc2a381e641c4e5"
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
          "sha256": "6682c17bdb11ea4269540e3a4f14546e013d72869ba19c79a41312cbc65419bf"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-number-view.mjs",
          "sha256": "6940f11e30d2958d7f6771463ce28ca83c0e2d2f41e81aa220c8efe669580300"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs",
          "sha256": "a2b5b4fe2499168ee8afe10cc3aa767f56757b376531ab63e4c557b5ed26ea52"
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
          "sha256": "556109c32d2f85be4b043513362d682ed7e14811a21a6f08200ac65c53af5d48"
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
          "sha256": "1ec30c252d7f0fa8d65905f66eeca76da1644778b9ad710da5487ab667759c82"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-panel.module.css",
          "sha256": "31ef143f21af5f6ed0aba4f11bf1cf79549ae97c462ed0bef2daaf3e67635250"
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
          "sha256": "f9acac2e8589afce076c51e07ef2bd4c3a67360faa9970b2cbbd447502c98bc0"
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
          "sha256": "456e78d9e5c729182e65cd30141af37a5a6571d05261896ab5e19e39c4951c1b"
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
          "sha256": "339fee2591a341bbb7839a19d55a5c298c728ef1de38a2efc3680999f4636db4"
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
          "sha256": "d3dffce08238141f672a8af0c1b956da15809e18608084b9bdf57d50ae166ceb"
        },
        {
          "path": "src/lib/field-operations-policy.mjs",
          "sha256": "bb33655b622a081de656f24c2e369fe7a2e05a0a0a9da7ffe455c2f39fd8fbd5"
        },
        {
          "path": "src/lib/field-operations-store.mjs",
          "sha256": "8f54edfb613fcf90f099015d42c89e993e5d3ca74f5bd11e9743830324547604"
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
          "sha256": "efc8bb1f69a79a087c7e374e6028bc944707393d91ec19d0f548592d489dc71a"
        },
        {
          "path": "package.json",
          "sha256": "4a97436407ad4f19ef95fb382780e70c16e725bd67075a6eeadbaf6a245d6394"
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
          "sha256": "197fa68dacf6ad8adee77f55370363e1bdba63f442d7a7196c96ae95b8829fe7"
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
          "sha256": "18f3616144c03aacf9c9859ae210150d92f6838de7332cee2550fa5fe91603fb"
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
          "sha256": "f9acac2e8589afce076c51e07ef2bd4c3a67360faa9970b2cbbd447502c98bc0"
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
          "sha256": "c3cf9eed8983b9ab43ad9b11cf0f59af206b08ba70f5e6697133bb448b940662"
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
          "sha256": "d3dffce08238141f672a8af0c1b956da15809e18608084b9bdf57d50ae166ceb"
        },
        {
          "path": "src/lib/field-operations-policy.mjs",
          "sha256": "bb33655b622a081de656f24c2e369fe7a2e05a0a0a9da7ffe455c2f39fd8fbd5"
        },
        {
          "path": "src/lib/field-operations-store.mjs",
          "sha256": "8f54edfb613fcf90f099015d42c89e993e5d3ca74f5bd11e9743830324547604"
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
          "sha256": "efc8bb1f69a79a087c7e374e6028bc944707393d91ec19d0f548592d489dc71a"
        },
        {
          "path": "package.json",
          "sha256": "4a97436407ad4f19ef95fb382780e70c16e725bd67075a6eeadbaf6a245d6394"
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
          "sha256": "d3dffce08238141f672a8af0c1b956da15809e18608084b9bdf57d50ae166ceb"
        },
        {
          "path": "src/lib/field-operations-policy.mjs",
          "sha256": "bb33655b622a081de656f24c2e369fe7a2e05a0a0a9da7ffe455c2f39fd8fbd5"
        },
        {
          "path": "src/lib/field-operations-store.mjs",
          "sha256": "8f54edfb613fcf90f099015d42c89e993e5d3ca74f5bd11e9743830324547604"
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
        "src/app/(identity)/cuenta/kyc-camera-session.mjs",
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
        "src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs",
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
          "sha256": "efc8bb1f69a79a087c7e374e6028bc944707393d91ec19d0f548592d489dc71a"
        },
        {
          "path": "package.json",
          "sha256": "4a97436407ad4f19ef95fb382780e70c16e725bd67075a6eeadbaf6a245d6394"
        },
        {
          "path": "scripts/lib/home-decisions-current-ci-lineage.mjs",
          "sha256": "ae44e43ec0202bffc3c729219fe9fdb6066363a970279f62cc4438d5d715ead5"
        },
        {
          "path": "scripts/lib/integrated-identity-current-ci-lineage.mjs",
          "sha256": "aaf23ee0e97231520f29669136d969ffc513bd6b52067df751d3dc6cf9c86bb8"
        },
        {
          "path": "scripts/lib/material-review-current-ci-lineage.mjs",
          "sha256": "9155e03f6c6831e8122263b73c16a724645fc5cd3ebcfdd950c0413543c12a64"
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
          "sha256": "30dc60ecb4f6aee0044a27d787508d47fa748febad177743c7ca585cd0a231d2"
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
          "sha256": "6ced258e2d012c26481f8f63e8d8bfbfc6011afd6a456f7d463b8aec94393621"
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
          "sha256": "b439d95c9e48f4b0ef83bd6ca93efac56dc059a8b50b508475d9d5e29af4b6dc"
        },
        {
          "path": "src/app/(identity)/cuenta/company-subscription-panel.module.css",
          "sha256": "678a18a7ad87f8312a7ad9e8267709297653e7572ea4b537ac42b6959b3a523a"
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
          "sha256": "197fa68dacf6ad8adee77f55370363e1bdba63f442d7a7196c96ae95b8829fe7"
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
          "sha256": "18f3616144c03aacf9c9859ae210150d92f6838de7332cee2550fa5fe91603fb"
        },
        {
          "path": "src/app/(identity)/cuenta/invitation-entry.js",
          "sha256": "a6c8a1499bcd170afb52120d56ecbddb1241a34d2aa483528d03f306e2c2a481"
        },
        {
          "path": "src/app/(identity)/cuenta/kyc-camera-session.mjs",
          "sha256": "e84404979093aaad5179cf47433b3930ddc71e7677fe36db6018fcd49bf8e5c4"
        },
        {
          "path": "src/app/(identity)/cuenta/kyc-photo-preparation.js",
          "sha256": "d88c55b9fb97b6b1abb5ecb02cf66b9d8e016821525f1b6a3cc2a381e641c4e5"
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
          "sha256": "6682c17bdb11ea4269540e3a4f14546e013d72869ba19c79a41312cbc65419bf"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-number-view.mjs",
          "sha256": "6940f11e30d2958d7f6771463ce28ca83c0e2d2f41e81aa220c8efe669580300"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs",
          "sha256": "a2b5b4fe2499168ee8afe10cc3aa767f56757b376531ab63e4c557b5ed26ea52"
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
          "sha256": "556109c32d2f85be4b043513362d682ed7e14811a21a6f08200ac65c53af5d48"
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
          "sha256": "1ec30c252d7f0fa8d65905f66eeca76da1644778b9ad710da5487ab667759c82"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-panel.module.css",
          "sha256": "31ef143f21af5f6ed0aba4f11bf1cf79549ae97c462ed0bef2daaf3e67635250"
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
          "sha256": "f9acac2e8589afce076c51e07ef2bd4c3a67360faa9970b2cbbd447502c98bc0"
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
          "sha256": "456e78d9e5c729182e65cd30141af37a5a6571d05261896ab5e19e39c4951c1b"
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
          "sha256": "339fee2591a341bbb7839a19d55a5c298c728ef1de38a2efc3680999f4636db4"
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
          "sha256": "efc8bb1f69a79a087c7e374e6028bc944707393d91ec19d0f548592d489dc71a"
        },
        {
          "path": "package.json",
          "sha256": "4a97436407ad4f19ef95fb382780e70c16e725bd67075a6eeadbaf6a245d6394"
        },
        {
          "path": "scripts/lib/field-outbound-current-ci-lineage.mjs",
          "sha256": "7801d9d074c4451178d7900d605aa75c91ebf6b4a82a24f997e89d0284008c7b"
        },
        {
          "path": "scripts/lib/home-decisions-current-ci-lineage.mjs",
          "sha256": "ae44e43ec0202bffc3c729219fe9fdb6066363a970279f62cc4438d5d715ead5"
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
          "sha256": "9155e03f6c6831e8122263b73c16a724645fc5cd3ebcfdd950c0413543c12a64"
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
          "sha256": "30dc60ecb4f6aee0044a27d787508d47fa748febad177743c7ca585cd0a231d2"
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
          "sha256": "8839de070fd4629ebf676467232ea89149c328d92db095f6dd185b36090367ee"
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
          "sha256": "197fa68dacf6ad8adee77f55370363e1bdba63f442d7a7196c96ae95b8829fe7"
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
          "sha256": "18f3616144c03aacf9c9859ae210150d92f6838de7332cee2550fa5fe91603fb"
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
          "sha256": "205759c15cd2925f027743fd1539c3989b27d6521b6294cbf99f2278dea842d1"
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
          "sha256": "8f54edfb613fcf90f099015d42c89e993e5d3ca74f5bd11e9743830324547604"
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
          "sha256": "93c30d36b4a5f3c9b453e907a4ff189dee73879987eb85952cfd2841c26e4594"
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
          "sha256": "77dc9f64814f995d21084606d705f26af65de4f4f9bea25a0f37a0d8dba1b928"
        },
        {
          "path": "src/lib/meta-field-bridge.mjs",
          "sha256": "79c961cf91f988e5d913cfb241a887c26a78d49e04ebf2c5fbb2bf6a74bc809b"
        },
        {
          "path": "src/lib/meta-field-conversation.mjs",
          "sha256": "2da5b4a58e4f62a912d4df4bd93574c9907c6561123fe5ffabdd12420b72047f"
        },
        {
          "path": "src/lib/meta-kyc-challenge.mjs",
          "sha256": "f5a03ec770e6d85de095393bf38c331c0803a7fe3c7f1b72a2addd9cac7484eb"
        },
        {
          "path": "src/lib/meta-kyc-conversation.mjs",
          "sha256": "2ba67025781ab2f6cd629ec3643060c4ab04b2b8fd7cd50ac87c6973c6d083f5"
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
          "sha256": "efc8bb1f69a79a087c7e374e6028bc944707393d91ec19d0f548592d489dc71a"
        },
        {
          "path": "package.json",
          "sha256": "4a97436407ad4f19ef95fb382780e70c16e725bd67075a6eeadbaf6a245d6394"
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
          "sha256": "8f54edfb613fcf90f099015d42c89e993e5d3ca74f5bd11e9743830324547604"
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
          "sha256": "93c30d36b4a5f3c9b453e907a4ff189dee73879987eb85952cfd2841c26e4594"
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
          "sha256": "77dc9f64814f995d21084606d705f26af65de4f4f9bea25a0f37a0d8dba1b928"
        },
        {
          "path": "src/lib/meta-field-bridge.mjs",
          "sha256": "79c961cf91f988e5d913cfb241a887c26a78d49e04ebf2c5fbb2bf6a74bc809b"
        },
        {
          "path": "src/lib/meta-field-conversation.mjs",
          "sha256": "2da5b4a58e4f62a912d4df4bd93574c9907c6561123fe5ffabdd12420b72047f"
        },
        {
          "path": "src/lib/meta-kyc-challenge.mjs",
          "sha256": "f5a03ec770e6d85de095393bf38c331c0803a7fe3c7f1b72a2addd9cac7484eb"
        },
        {
          "path": "src/lib/meta-kyc-conversation.mjs",
          "sha256": "2ba67025781ab2f6cd629ec3643060c4ab04b2b8fd7cd50ac87c6973c6d083f5"
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
          "sha256": "339fee2591a341bbb7839a19d55a5c298c728ef1de38a2efc3680999f4636db4"
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
          "sha256": "efc8bb1f69a79a087c7e374e6028bc944707393d91ec19d0f548592d489dc71a"
        },
        {
          "path": "package.json",
          "sha256": "4a97436407ad4f19ef95fb382780e70c16e725bd67075a6eeadbaf6a245d6394"
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
          "sha256": "26686333bb7d5fcddf40b14f25b8c322e16ddef0d62690b2e6d1d1b4a6de2e72"
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
          "sha256": "8f54edfb613fcf90f099015d42c89e993e5d3ca74f5bd11e9743830324547604"
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
          "sha256": "93c30d36b4a5f3c9b453e907a4ff189dee73879987eb85952cfd2841c26e4594"
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
          "sha256": "77dc9f64814f995d21084606d705f26af65de4f4f9bea25a0f37a0d8dba1b928"
        },
        {
          "path": "src/lib/meta-field-bridge.mjs",
          "sha256": "79c961cf91f988e5d913cfb241a887c26a78d49e04ebf2c5fbb2bf6a74bc809b"
        },
        {
          "path": "src/lib/meta-field-conversation.mjs",
          "sha256": "2da5b4a58e4f62a912d4df4bd93574c9907c6561123fe5ffabdd12420b72047f"
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
          "sha256": "2ba67025781ab2f6cd629ec3643060c4ab04b2b8fd7cd50ac87c6973c6d083f5"
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
          "sha256": "33ac37426beb73a142804bc6e6c903d0d18527282dfb590bf685b74e20df2bf5"
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
          "sha256": "efc8bb1f69a79a087c7e374e6028bc944707393d91ec19d0f548592d489dc71a"
        },
        {
          "path": "package.json",
          "sha256": "4a97436407ad4f19ef95fb382780e70c16e725bd67075a6eeadbaf6a245d6394"
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
          "sha256": "8f54edfb613fcf90f099015d42c89e993e5d3ca74f5bd11e9743830324547604"
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
          "sha256": "93c30d36b4a5f3c9b453e907a4ff189dee73879987eb85952cfd2841c26e4594"
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
          "sha256": "77dc9f64814f995d21084606d705f26af65de4f4f9bea25a0f37a0d8dba1b928"
        },
        {
          "path": "src/lib/meta-field-bridge.mjs",
          "sha256": "79c961cf91f988e5d913cfb241a887c26a78d49e04ebf2c5fbb2bf6a74bc809b"
        },
        {
          "path": "src/lib/meta-field-conversation.mjs",
          "sha256": "2da5b4a58e4f62a912d4df4bd93574c9907c6561123fe5ffabdd12420b72047f"
        },
        {
          "path": "src/lib/meta-kyc-challenge.mjs",
          "sha256": "f5a03ec770e6d85de095393bf38c331c0803a7fe3c7f1b72a2addd9cac7484eb"
        },
        {
          "path": "src/lib/meta-kyc-conversation.mjs",
          "sha256": "2ba67025781ab2f6cd629ec3643060c4ab04b2b8fd7cd50ac87c6973c6d083f5"
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
          "sha256": "efc8bb1f69a79a087c7e374e6028bc944707393d91ec19d0f548592d489dc71a"
        },
        {
          "path": "package.json",
          "sha256": "4a97436407ad4f19ef95fb382780e70c16e725bd67075a6eeadbaf6a245d6394"
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
          "sha256": "8f54edfb613fcf90f099015d42c89e993e5d3ca74f5bd11e9743830324547604"
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
          "sha256": "93c30d36b4a5f3c9b453e907a4ff189dee73879987eb85952cfd2841c26e4594"
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
          "sha256": "77dc9f64814f995d21084606d705f26af65de4f4f9bea25a0f37a0d8dba1b928"
        },
        {
          "path": "src/lib/meta-field-bridge.mjs",
          "sha256": "79c961cf91f988e5d913cfb241a887c26a78d49e04ebf2c5fbb2bf6a74bc809b"
        },
        {
          "path": "src/lib/meta-field-conversation.mjs",
          "sha256": "2da5b4a58e4f62a912d4df4bd93574c9907c6561123fe5ffabdd12420b72047f"
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
          "sha256": "2ba67025781ab2f6cd629ec3643060c4ab04b2b8fd7cd50ac87c6973c6d083f5"
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
          "sha256": "b439d95c9e48f4b0ef83bd6ca93efac56dc059a8b50b508475d9d5e29af4b6dc"
        },
        {
          "path": "src/app/(identity)/cuenta/company-subscription-panel.module.css",
          "sha256": "678a18a7ad87f8312a7ad9e8267709297653e7572ea4b537ac42b6959b3a523a"
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
          "sha256": "efc8bb1f69a79a087c7e374e6028bc944707393d91ec19d0f548592d489dc71a"
        },
        {
          "path": "package.json",
          "sha256": "4a97436407ad4f19ef95fb382780e70c16e725bd67075a6eeadbaf6a245d6394"
        },
        {
          "path": "scripts/lib/home-decisions-current-ci-lineage.mjs",
          "sha256": "ae44e43ec0202bffc3c729219fe9fdb6066363a970279f62cc4438d5d715ead5"
        },
        {
          "path": "scripts/lib/plan-budget-browser-ui.mjs",
          "sha256": "67ca623eef0518314e53f7a92ec19f818f698b620f0e22833a27593e5a08f5a1"
        },
        {
          "path": "scripts/lib/plan-budget-current-ci-lineage.mjs",
          "sha256": "30dc60ecb4f6aee0044a27d787508d47fa748febad177743c7ca585cd0a231d2"
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
          "sha256": "339fee2591a341bbb7839a19d55a5c298c728ef1de38a2efc3680999f4636db4"
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
  "ownRuntimeDiagnosticAdvance": {
    "version": 1,
    "kind": "OWN_RUNTIME_DIAGNOSTIC_SOURCE_ADVANCE",
    "previousContractSha256": "75140c878ebd4792bf59da6aa4dbc0f2db082963c8518acf867cffc7f78f5ac0",
    "previousReviewedSha256": "f0c0c1e40171f3ed6d2af16bed2504eaf640ce9dff9995b33bd4c76d90b664da",
    "sourceChanges": [
      {
        "path": "package-lock.json",
        "status": "MODIFIED",
        "previousSha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449",
        "currentSha256": "efc8bb1f69a79a087c7e374e6028bc944707393d91ec19d0f548592d489dc71a",
        "previousBytes": 334076,
        "currentBytes": 333310,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 716,
            "currentText": "4.3",
            "previousText": "3.8"
          },
          {
            "currentOffsetCharacters": 797,
            "currentText": "25.13",
            "previousText": "^25.10"
          },
          {
            "currentOffsetCharacters": 1038,
            "currentText": "4.3",
            "previousText": "3.8"
          },
          {
            "currentOffsetCharacters": 43666,
            "currentText": "4.3\",\n      \"resolved\": \"https://registry.npmjs.org/@next/env/-/env-16.4.3.tgz\",\n      \"integrity\": \"sha512-a7tz1QCcWWkwC/rPJcPMJk/UNRu9CFhDd3OHYE5hddbJrs8BqRTalxI6GlKCWEGzRLHN+S/B7a4PAHCtm25aBQ",
            "previousText": "3.8\",\n      \"resolved\": \"https://registry.npmjs.org/@next/env/-/env-16.3.8.tgz\",\n      \"integrity\": \"sha512-Al9zqHVV7TJv0eFuOU4U7Lvv74PTih4Ch63sk2xCIpSTkE3udFnaOcnzP2lQVymiL7yS9Cj2iClUXlR3EQ5sEw"
          },
          {
            "currentOffsetCharacters": 43963,
            "currentText": "4.3\",\n      \"resolved\": \"https://registry.npmjs.org/@next/eslint-plugin-next/-/eslint-plugin-next-16.4.3.tgz\",\n      \"integrity\": \"sha512-oxuC06wt/71h6ACYCV9GbKOfnf5a7VlRe/p80YHTut15TNgDEmynDnaq8t/xhy5rlvk7dhItIPs6H3rvIM4ky",
            "previousText": "3.8\",\n      \"resolved\": \"https://registry.npmjs.org/@next/eslint-plugin-next/-/eslint-plugin-next-16.3.8.tgz\",\n      \"integrity\": \"sha512-eCR9RcLTZrVS+K3+VOhi0xMdUUGNuriCHHhU1ZoABC/QQ/Gp0OWbLKQxV2/9DkmihYdYRcQWFmZXW8M1AMUXY"
          },
          {
            "currentOffsetCharacters": 44420,
            "currentText": "4.3\",\n      \"resolved\": \"https://registry.npmjs.org/@next/swc-darwin-arm64/-/swc-darwin-arm64-16.4.3.tgz\",\n      \"integrity\": \"sha512-4yq5EXBt+VDtAZwTyfijaFp5D2C5oz3Ikw5a2kiX2K9nw72vrZX2q5UuAlkPtUMO1tQz6JTKpaKWjS7OOefTDQ",
            "previousText": "3.8\",\n      \"resolved\": \"https://registry.npmjs.org/@next/swc-darwin-arm64/-/swc-darwin-arm64-16.3.8.tgz\",\n      \"integrity\": \"sha512-2JPRMh2nmQG5CiL7cXGL9AGwnPWJQ//cTtAUCT+w511QHk79SYz3LGv/pc5X643B/WEO0rvu3Yww0hqwt3kgeA"
          },
          {
            "currentOffsetCharacters": 44895,
            "currentText": "4.3\",\n      \"resolved\": \"https://registry.npmjs.org/@next/swc-darwin-x64/-/swc-darwin-x64-16.4.3.tgz\",\n      \"integrity\": \"sha512-1Rvkn/LUhnEF8WxnRkOrqGhbwXui1bkWFxONKIbN+r7C+9KHDSZ+iUoj4CzymVMWUyZIyx9szcb9+kbKhD500A",
            "previousText": "3.8\",\n      \"resolved\": \"https://registry.npmjs.org/@next/swc-darwin-x64/-/swc-darwin-x64-16.3.8.tgz\",\n      \"integrity\": \"sha512-GZtCCOBKJ4leVIT/Th0llWKhD1ca92lzbQiS5R5ON9QkoiFnilFsebDae1JU2a3HWoKMEmEZWGs1AGLavVM72Q"
          },
          {
            "currentOffsetCharacters": 45369,
            "currentText": "4.3\",\n      \"resolved\": \"https://registry.npmjs.org/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-16.4.3.tgz\",\n      \"integrity\": \"sha512-dCKpXErGg3abUM6t5JTJV/ottVBTStJB5lRJTbgdUdQaQ+jNHiK56Hsc0YAEg/rinSh42hYG3HWiYmEMdilnxg",
            "previousText": "3.8\",\n      \"resolved\": \"https://registry.npmjs.org/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-16.3.8.tgz\",\n      \"integrity\": \"sha512-O659ygeQYqneJ1fBKMpFxIFqYkYswu8IAS1OCKK/4f3ZgJJm1dRz4fVJZRi/kLLWjnBKnebOePA4WNv+sV1pVA"
          },
          {
            "currentOffsetCharacters": 45896,
            "currentText": "4.3\",\n      \"resolved\": \"https://registry.npmjs.org/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-16.4.3.tgz\",\n      \"integrity\": \"sha512-WwYbhWkhYBvBtib1K4W0kL8MW2snBD2A5b3SN4vPpqalZbZs5+bQ1yzAdepVoOqrFfEW3dmREy4Zs1MrWcrFbw",
            "previousText": "3.8\",\n      \"resolved\": \"https://registry.npmjs.org/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-16.3.8.tgz\",\n      \"integrity\": \"sha512-dSjKSyWpzxoO1d3DIZZcP4XJcNaKeLmxQMFOiYl5vuBRMmweIqnAhty8tAmRsvTss779cK1FtYnDMj40e4TQlg"
          },
          {
            "currentOffsetCharacters": 46421,
            "currentText": "4.3\",\n      \"resolved\": \"https://registry.npmjs.org/@next/swc-linux-x64-gnu/-/swc-linux-x64-gnu-16.4.3.tgz\",\n      \"integrity\": \"sha512-QymWvfUwDEC5/lpJOsxX5VAbyoR2D13+2Jsjz4be7gT4LPqEgdpkeLIR/HFfCLgKzoMhpJbp6I/JnogyNZHcaA",
            "previousText": "3.8\",\n      \"resolved\": \"https://registry.npmjs.org/@next/swc-linux-x64-gnu/-/swc-linux-x64-gnu-16.3.8.tgz\",\n      \"integrity\": \"sha512-lbqOuz3RPRcv+o9msNsJw5x4+Y1ZwPTs6vmL6DCf7i0fZfvng/F59wyeDwqHIvV0mK//RBy/jJkZ+nCKsSMXjQ"
          },
          {
            "currentOffsetCharacters": 46940,
            "currentText": "4.3\",\n      \"resolved\": \"https://registry.npmjs.org/@next/swc-linux-x64-musl/-/swc-linux-x64-musl-16.4.3.tgz\",\n      \"integrity\": \"sha512-Vmjd9D7DpA4Vv3cUlr82QWgJD/BQZmns801vtC5VWHg6jCIA4a5vMKpQnfrM2pyCrp2eV0ENdUg4PlN3bAc2Yw",
            "previousText": "3.8\",\n      \"resolved\": \"https://registry.npmjs.org/@next/swc-linux-x64-musl/-/swc-linux-x64-musl-16.3.8.tgz\",\n      \"integrity\": \"sha512-+316WswI8ScVgZeUd+1KGaXkHhaYQzCjvH/05TZSpJ8zBizb1a4G7DtO7F12jcBIqMOtsz9ji1t48fmKtzqsGA"
          },
          {
            "currentOffsetCharacters": 47462,
            "currentText": "4.3\",\n      \"resolved\": \"https://registry.npmjs.org/@next/swc-win32-arm64-msvc/-/swc-win32-arm64-msvc-16.4.3.tgz\",\n      \"integrity\": \"sha512-lG1pPdPLk7gTyGb00n5JIMLdBJgjb+UEhSdZvFbhUMg0DyC6z4B7RnpSKF9VCd4imkLObVbXOFA0kFCpw7yFo",
            "previousText": "3.8\",\n      \"resolved\": \"https://registry.npmjs.org/@next/swc-win32-arm64-msvc/-/swc-win32-arm64-msvc-16.3.8.tgz\",\n      \"integrity\": \"sha512-ji0gd4kMYUxO+1fJBIbiBVRCjzG/lloiyCccnlebvb1ZJ5qXCPZqYg4Jl1DrrixnWNMKylzgpmMWx0yNDYXlz"
          },
          {
            "currentOffsetCharacters": 47948,
            "currentText": "4.3\",\n      \"resolved\": \"https://registry.npmjs.org/@next/swc-win32-x64-msvc/-/swc-win32-x64-msvc-16.4.3.tgz\",\n      \"integrity\": \"sha512-NmQC9RkJdnPXRaMxtkCzobB3teVjqF33oSOnwDfi+XYGWWYpt+xlGK3mtktSKLbdjwaWbJu2OkkMiRFGUUncK",
            "previousText": "3.8\",\n      \"resolved\": \"https://registry.npmjs.org/@next/swc-win32-x64-msvc/-/swc-win32-x64-msvc-16.3.8.tgz\",\n      \"integrity\": \"sha512-WcTlaKt/TWkh5kUjdJcUmB1XgZ+1c6fz4Y9fDHL73YNSdGaUWjceeWrrlwF0nv19iABYWC4iAq1oX1w4Bn0vf"
          },
          {
            "currentOffsetCharacters": 60339,
            "currentText": "4\",\n      \"resolved\": \"https://registry.npmjs.org/@puppeteer/browsers/-/browsers-3.2.4.tgz\",\n      \"integrity\": \"sha512-okJ6yQMc0SBexOKxMi966omwAV1uAPwgF/YMZdb04gZQPXVjWHl9bmXjZYtIcsN1+PN3Bz4iFfGK3g+c6lZJ0Q",
            "previousText": "2\",\n      \"resolved\": \"https://registry.npmjs.org/@puppeteer/browsers/-/browsers-3.2.2.tgz\",\n      \"integrity\": \"sha512-q2BU4YfO9h/Wt7IcWPcggpOOqLk2Tbs1hDwolvKZrweRjy751OJBKMN9zO5bfD0pzU7X/tvKw/exQds4pM/LOg"
          },
          {
            "currentOffsetCharacters": 60633,
            "currentText": "5",
            "previousText": "4"
          },
          {
            "currentOffsetCharacters": 99456,
            "currentText": "",
            "previousText": "    \"node_modules/@vercel/cli-config/node_modules/zod\": {\n      \"version\": \"4.1.11\",\n      \"resolved\": \"https://registry.npmjs.org/zod/-/zod-4.1.11.tgz\",\n      \"integrity\": \"sha512-WPsqwxITS2tzx1bzhIKsEs19ABD5vmCVa4xBo2tq/SrV4RNZtfws1EnCWQXM6yh8bD08a1idvkB5MZSBiZsjwg==\",\n      \"license\": \"MIT\",\n      \"funding\": {\n        \"url\": \"https://github.com/sponsors/colinhacks\"\n      }\n    },\n"
          },
          {
            "currentOffsetCharacters": 107642,
            "currentText": "4.0\",\n      \"resolved\": \"https://registry.npmjs.org/ansi-regex/-/ansi-regex-6.4.0.tgz\",\n      \"integrity\": \"sha512-KzTVk2tCWAHtYrvvvaP8bJKJq2pVinhLcGEQdtLIYPbmNGNyYe8QwNaTUYQp2J7/vIsUKt5QCqAfUkYyG9DkOw",
            "previousText": "3.0\",\n      \"resolved\": \"https://registry.npmjs.org/ansi-regex/-/ansi-regex-6.3.0.tgz\",\n      \"integrity\": \"sha512-WpDfL7NO6j7tH88IDBNVdUJxDh9nmCteAVW9dsep846XdwF4naCBK+/tGLX3KJgcpgMRXCFlTM2hKGoK9FsdrQ"
          },
          {
            "currentOffsetCharacters": 127397,
            "currentText": "57.0.8090-0\",\n      \"resolved\": \"https://registry.npmjs.org/chromium-bidi/-/chromium-bidi-157.0.8090-0.tgz\",\n      \"integrity\": \"sha512-KJw7IQgqXwxpJgJlEIPg5mr2ZoqA+jkTRtc5EABI7sUJ3bu3cpI7NuEBoj4Gn1AsF78CaT9So5WQWspK3/wYa",
            "previousText": "7.0.2\",\n      \"resolved\": \"https://registry.npmjs.org/chromium-bidi/-/chromium-bidi-17.0.2.tgz\",\n      \"integrity\": \"sha512-5v9GQFhTktFvotn/OFNJBmKLKRAb6n9r0bVCwf7sHgWc3/JryK0bj1nn93L3pHFrfgcsu6Be6EWsDi+1XHTGD"
          },
          {
            "currentOffsetCharacters": 127722,
            "currentText": "4.6.5",
            "previousText": "3.24.1"
          },
          {
            "currentOffsetCharacters": 127891,
            "currentText": "",
            "previousText": "    \"node_modules/chromium-bidi/node_modules/zod\": {\n      \"version\": \"3.25.76\",\n      \"resolved\": \"https://registry.npmjs.org/zod/-/zod-3.25.76.tgz\",\n      \"integrity\": \"sha512-gzUt/qt81nXsFGKIFcC3YnfEAx5NkunCfnDlvuBSSFS02bcXu4Lmea0AFIUwbLWxWPx3d9p8S5QoaujKcNQxcQ==\",\n      \"license\": \"MIT\",\n      \"funding\": {\n        \"url\": \"https://github.com/sponsors/colinhacks\"\n      }\n    },\n"
          },
          {
            "currentOffsetCharacters": 145044,
            "currentText": "96802\",\n      \"resolved\": \"https://registry.npmjs.org/devtools-protocol/-/devtools-protocol-0.0.1696802.tgz\",\n      \"integrity\": \"sha512-FO5/SENfvc2K8wRnWQflKcwuoTH4dBkXCWTQ9ebIWtuX8JM5+ZvCotaEmkfh21pO7TvIKGTM3hG4xFiq9WTwm",
            "previousText": "66840\",\n      \"resolved\": \"https://registry.npmjs.org/devtools-protocol/-/devtools-protocol-0.0.1666840.tgz\",\n      \"integrity\": \"sha512-gCcO42XCHKEs7Ag0S7aGYsnJ7hlgrO3qderYqeiY0Eqk+0GFfuvT13IA0hHreJTa2KCdDVyGMeOhdMNmrrTjV"
          },
          {
            "currentOffsetCharacters": 146080,
            "currentText": "7\",\n      \"resolved\": \"https://registry.npmjs.org/dompurify/-/dompurify-3.4.17.tgz\",\n      \"integrity\": \"sha512-B/pSlYVHQ58kqISD/yDjuJ1yfzI34m1gF4lAod2bwSRhiN4K5Cl3H8Af7hqB2PmTL911tdEudnnXn5FnhRoz0w",
            "previousText": "6\",\n      \"resolved\": \"https://registry.npmjs.org/dompurify/-/dompurify-3.4.16.tgz\",\n      \"integrity\": \"sha512-sqo+pNp3qRhCIpbgRi1y8Tgk27Bo2Ry7w0dC1NBeNTdZChWjz9Xb/KOoZbRP/R6pQZ80Qw8YhXw13hWWBbMRnQ"
          },
          {
            "currentOffsetCharacters": 159229,
            "currentText": "4.3\",\n      \"resolved\": \"https://registry.npmjs.org/eslint-config-next/-/eslint-config-next-16.4.3.tgz\",\n      \"integrity\": \"sha512-j9IqBma6abp800frdUURaizYMgXOK+jNGyq6CsYcM9AxpSJs5D/TgMNGeAmRUilZvA7g9V1Tr71gNg9/SVTuMQ",
            "previousText": "3.8\",\n      \"resolved\": \"https://registry.npmjs.org/eslint-config-next/-/eslint-config-next-16.3.8.tgz\",\n      \"integrity\": \"sha512-81vovwMe6NGnoFsl0KUJWzlS+y239i3fdsxs49gSEX3pDQW2cuKy+fxUPXNkQqqx6OCPheYPtBlSufc9aZ0k+w"
          },
          {
            "currentOffsetCharacters": 159559,
            "currentText": "4.3",
            "previousText": "3.8"
          },
          {
            "currentOffsetCharacters": 159840,
            "currentText": "1",
            "previousText": "0"
          },
          {
            "currentOffsetCharacters": 159908,
            "currentText": "5",
            "previousText": "4"
          },
          {
            "currentOffsetCharacters": 176615,
            "currentText": "9\",\n      \"resolved\": \"https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.9.tgz\",\n      \"integrity\": \"sha512-hS/0Wt3Ya043oKXs0sIxrMpKQITXhMLIrVAKKXi4gozGC9v7YRWVnXIZzjNPTO02M9BdxLCWqK1yRXgNziVyJQ",
            "previousText": "8\",\n      \"resolved\": \"https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.8.tgz\",\n      \"integrity\": \"sha512-GZMtZUTNRpOVIECoXwLNZS5xUGE+mVNbTB8h/7Rwh2TFWcBQiPzTgyZi05BF9UMZKkLJv8XBRJTlU7zg8+ZfMg"
          },
          {
            "currentOffsetCharacters": 186695,
            "currentText": "7.0\",\n      \"resolved\": \"https://registry.npmjs.org/get-east-asian-width/-/get-east-asian-width-1.7.0.tgz\",\n      \"integrity\": \"sha512-XjH1AECxf0giL2V1aU8vKyRR2ppRUb5c0EvT7zuJTokQ74bNo52zOtghqdWIqrhUD79fo3x0WfKZdOqxF6LG1Q",
            "previousText": "6.0\",\n      \"resolved\": \"https://registry.npmjs.org/get-east-asian-width/-/get-east-asian-width-1.6.0.tgz\",\n      \"integrity\": \"sha512-QRbvDIbx6YklUe6RxeTeleMR0yv3cYH6PsPZHcnVn7xv7zO1BHN8r0XETu8n6Ye3Q+ahtSarc3WgtNWmehIBfA"
          },
          {
            "currentOffsetCharacters": 233910,
            "currentText": "6\",\n      \"resolved\": \"https://registry.npmjs.org/modern-tar/-/modern-tar-0.8.6.tgz\",\n      \"integrity\": \"sha512-LYSks0tNVqbtez/9OB0YFP6qLRSqkdAxJWOQpVaR67lNTbj2zNLyYpowkRMia5lXLCZKzxwoxkxH2MbbBR2aE",
            "previousText": "4\",\n      \"resolved\": \"https://registry.npmjs.org/modern-tar/-/modern-tar-0.8.4.tgz\",\n      \"integrity\": \"sha512-gN54ddmyzEg10orwZ2u4OOv+bjpMWdIl5jIkodK97bMq8QBSL5c0D7YX0lT1Ooz+99S7+PvFbnxzdjgHo1r41"
          },
          {
            "currentOffsetCharacters": 237722,
            "currentText": "4.3\",\n      \"resolved\": \"https://registry.npmjs.org/next/-/next-16.4.3.tgz\",\n      \"integrity\": \"sha512-OqxKTGi9u80FydydsMNYNjnuje9Au+kvHlt2GZ//ftdpDHm1dxKqAaENoOOTX5wKzn+9vaKUNIfZeyZUuLhCnA",
            "previousText": "3.8\",\n      \"resolved\": \"https://registry.npmjs.org/next/-/next-16.3.8.tgz\",\n      \"integrity\": \"sha512-U7QEZaTini6wKrb8A8hqLLqYQyCetegKjCpJOyxk642vWoMoU1x5PyZCJFvgYgiptA8xc5j/9xYlZFO7w9Sjmw"
          },
          {
            "currentOffsetCharacters": 237990,
            "currentText": "4.3",
            "previousText": "3.8"
          },
          {
            "currentOffsetCharacters": 238367,
            "currentText": "4.3\",\n        \"@next/swc-darwin-x64\": \"16.4.3\",\n        \"@next/swc-linux-arm64-gnu\": \"16.4.3\",\n        \"@next/swc-linux-arm64-musl\": \"16.4.3\",\n        \"@next/swc-linux-x64-gnu\": \"16.4.3\",\n        \"@next/swc-linux-x64-musl\": \"16.4.3\",\n        \"@next/swc-win32-arm64-msvc\": \"16.4.3\",\n        \"@next/swc-win32-x64-msvc\": \"16.4.3\",\n        \"sharp\": \"^0.35.5",
            "previousText": "3.8\",\n        \"@next/swc-darwin-x64\": \"16.3.8\",\n        \"@next/swc-linux-arm64-gnu\": \"16.3.8\",\n        \"@next/swc-linux-arm64-musl\": \"16.3.8\",\n        \"@next/swc-linux-x64-gnu\": \"16.3.8\",\n        \"@next/swc-linux-x64-musl\": \"16.3.8\",\n        \"@next/swc-win32-arm64-msvc\": \"16.3.8\",\n        \"@next/swc-win32-x64-msvc\": \"16.3.8\",\n        \"sharp\": \"^0.35.4"
          },
          {
            "currentOffsetCharacters": 263134,
            "currentText": "3.0\",\n      \"resolved\": \"https://registry.npmjs.org/puppeteer/-/puppeteer-25.13.0.tgz\",\n      \"integrity\": \"sha512-vB4KLXTT5QqlikcOQ/xV0RY18bBVtNyLUTfqJ9mW+penHyoM+5DmANYuDCI4jgBtiL0eD9I5ZFSafW6/a6Trpg",
            "previousText": "0.0\",\n      \"resolved\": \"https://registry.npmjs.org/puppeteer/-/puppeteer-25.10.0.tgz\",\n      \"integrity\": \"sha512-9ZfkiaZDQWpGPJp9XTS+Bkn/D78hPvYmtjPfIBeybn05oeY6Jj7aiSbYdfcSQD2UMvC0vE7Yi9PSDo179euRzw"
          },
          {
            "currentOffsetCharacters": 263463,
            "currentText": "4\",\n        \"chromium-bidi\": \"157.0.8090-0\",\n        \"devtools-protocol\": \"0.0.1696802",
            "previousText": "2\",\n        \"chromium-bidi\": \"17.0.2\",\n        \"devtools-protocol\": \"0.0.1666840"
          },
          {
            "currentOffsetCharacters": 263614,
            "currentText": "3.0\",\n        \"typed-query-selector\": \"^2.12.3",
            "previousText": "0.0\",\n        \"typed-query-selector\": \"^2.12.2"
          },
          {
            "currentOffsetCharacters": 263865,
            "currentText": "3.0\",\n      \"resolved\": \"https://registry.npmjs.org/puppeteer-core/-/puppeteer-core-25.13.0.tgz\",\n      \"integrity\": \"sha512-cyBS0OEx3e9NS53B5F6+UazXtR7f9Tw0cR1/FbPW59/hV6JPZbkIiMnxK2543IkFp3rsGlLn1iPDLF77TJsJsA",
            "previousText": "0.0\",\n      \"resolved\": \"https://registry.npmjs.org/puppeteer-core/-/puppeteer-core-25.10.0.tgz\",\n      \"integrity\": \"sha512-Hy5eMQshOEMil4JUUx03h5pw1HYkYCso1RG/gcpPlFSd4cYPOcopxcXEAxpLPOkOPJb9LIJtwxuj66bSdvknFg"
          },
          {
            "currentOffsetCharacters": 264172,
            "currentText": "4\",\n        \"chromium-bidi\": \"157.0.8090-0\",\n        \"devtools-protocol\": \"0.0.1696802\",\n        \"typed-query-selector\": \"^2.12.3\",\n        \"webdriver-bidi-protocol\": \"1.0.1",
            "previousText": "2\",\n        \"chromium-bidi\": \"17.0.2\",\n        \"devtools-protocol\": \"0.0.1666840\",\n        \"typed-query-selector\": \"^2.12.2\",\n        \"webdriver-bidi-protocol\": \"0.4.3"
          },
          {
            "currentOffsetCharacters": 298012,
            "currentText": "3.0\",\n      \"resolved\": \"https://registry.npmjs.org/string-width/-/string-width-8.3.0.tgz\",\n      \"integrity\": \"sha512-ZbmZM0JCihQN91dWnxoipT2KOEyHqEyfRXUyjuRhW8b/xnqPDoq4gWEVApTVa9db2wN8mmoikgFBbjh71+cGeQ",
            "previousText": "2.2\",\n      \"resolved\": \"https://registry.npmjs.org/string-width/-/string-width-8.2.2.tgz\",\n      \"integrity\": \"sha512-GaPUh5gfdrYzqeVNZvUfT23vYYxXzKYidUcnMtJg/3rxRV63EFZy3k6xfKlmfeJD0176lnUV/Usr3XcwSvFzpg"
          },
          {
            "currentOffsetCharacters": 313804,
            "currentText": "3\",\n      \"resolved\": \"https://registry.npmjs.org/typed-query-selector/-/typed-query-selector-2.12.3.tgz\",\n      \"integrity\": \"sha512-/dtuMZyutHLlrxWhhC1uib00ELUr2dZ8C9B8YzZYsJmeE3V56OxRblrSM2UaF142pcMtak7ehZ6+poWGeehNIg",
            "previousText": "2\",\n      \"resolved\": \"https://registry.npmjs.org/typed-query-selector/-/typed-query-selector-2.12.2.tgz\",\n      \"integrity\": \"sha512-EOPFbyIub4ngnEdqi2yOcNeDLaX/0jcE1JoAXQDDMIthap7FoN795lc/SHfIq2d416VufXpM8z/lD+WRm2gfOQ"
          },
          {
            "currentOffsetCharacters": 316405,
            "currentText": "9.1\",\n      \"resolved\": \"https://registry.npmjs.org/undici/-/undici-6.29.1.tgz\",\n      \"integrity\": \"sha512-EvRlUt/QqAEvXdQeRMYUfwOQsfzpDztykrG2owGEE/rBOBoYv9uF39ZzsNDh4lTFHhTr2XOZjKkYgueD12ZmG",
            "previousText": "8.1\",\n      \"resolved\": \"https://registry.npmjs.org/undici/-/undici-6.28.1.tgz\",\n      \"integrity\": \"sha512-zWpdTVD54H48CIybL0rWQ3ukpb9d23wM7eH5RtfdmeP70cWHNjtfo7P4vZX+5CoDcO53J4Pu5uXp7lNfjc6DR"
          },
          {
            "currentOffsetCharacters": 321346,
            "currentText": "1.0.1\",\n      \"resolved\": \"https://registry.npmjs.org/webdriver-bidi-protocol/-/webdriver-bidi-protocol-1.0.1.tgz\",\n      \"integrity\": \"sha512-WXWs/aXF2a6Al1Z2/V/7Gp2oPZOAAmHjJOTmv4KCXRJ122IMj3tSSMc6a4q3K4QOmhQbse/Ahr+oTVJOU2dUiw",
            "previousText": "0.4.3\",\n      \"resolved\": \"https://registry.npmjs.org/webdriver-bidi-protocol/-/webdriver-bidi-protocol-0.4.3.tgz\",\n      \"integrity\": \"sha512-uuN0goWfxP22B7J/uAgBpOYNPttC+XVseYE+rSY5+rQ+YBeVz/VORw8WbmLVcqW78zNg5A4qnjNXYUWR3il2ig"
          },
          {
            "currentOffsetCharacters": 327694,
            "currentText": "2.0\",\n      \"resolved\": \"https://registry.npmjs.org/ws/-/ws-8.22.0.tgz\",\n      \"integrity\": \"sha512-Ydggc987+RO0AnWtZ/7Wq9FtNvcrL1b/RO0ud9mWjUPgDrsAAwQSF51sm2hm1XofbU/4jkpGEsLFsZZxU+1DOg",
            "previousText": "1.3\",\n      \"resolved\": \"https://registry.npmjs.org/ws/-/ws-8.21.3.tgz\",\n      \"integrity\": \"sha512-201TZ/kPWxoPr/OKWjquZR1SWKXcvxdH+e1xrx89b3YbmzLMFCLfnaG1HFIgWzJOEWZ7MvpK++odZufgYR50Rw"
          },
          {
            "currentOffsetCharacters": 330379,
            "currentText": "2.0\",\n      \"resolved\": \"https://registry.npmjs.org/yargs/-/yargs-18.2.0.tgz\",\n      \"integrity\": \"sha512-9OpKOLeaoNFecEp7P6iYbzze/5CqWoH7N3SMs/6y1XF4nMvFMspEGZzJ6uFi9MmQwXhyzqYoSEKO3tvA3Z/o2w",
            "previousText": "1.0\",\n      \"resolved\": \"https://registry.npmjs.org/yargs/-/yargs-18.1.0.tgz\",\n      \"integrity\": \"sha512-2rAgRKu54VsHkqI0/tYkmluGXHD4KW7yZoycuqDQ15QOTnc2VVfy0nN/1eMhnQLO00A+dwtK20xuCnc1YGeUyg"
          },
          {
            "currentOffsetCharacters": 332534,
            "currentText": "6.6\",\n      \"resolved\": \"https://registry.npmjs.org/zod/-/zod-4.6.6.tgz\",\n      \"integrity\": \"sha512-4UmzQUF5fxvfcYHlbjBmejU+w+hbDnWFx4aS8kBx7nPBHcO2SqPbpAG8snbdg+Xse4pRefR98hgjFgIMCI/UhA==\"",
            "previousText": "4.3\",\n      \"resolved\": \"https://registry.npmjs.org/zod/-/zod-4.4.3.tgz\",\n      \"integrity\": \"sha512-ytENFjIJFl2UwYglde2jchW2Hwm4GJFLDiSXWdTrJQBIN9Fcyp7n4DhxJEiWNAJMV1/BqWfW/kkg71UDcHJyTQ==\",\n      \"dev\": true"
          }
        ]
      },
      {
        "path": "package.json",
        "status": "MODIFIED",
        "previousSha256": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d",
        "currentSha256": "4a97436407ad4f19ef95fb382780e70c16e725bd67075a6eeadbaf6a245d6394",
        "previousBytes": 2099,
        "currentBytes": 2268,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 1589,
            "currentText": "4.3",
            "previousText": "3.8"
          },
          {
            "currentOffsetCharacters": 1658,
            "currentText": "25.13",
            "previousText": "^25.10"
          },
          {
            "currentOffsetCharacters": 1863,
            "currentText": "4.3",
            "previousText": "3.8"
          },
          {
            "currentOffsetCharacters": 1911,
            "currentText": "9",
            "previousText": "8"
          },
          {
            "currentOffsetCharacters": 2060,
            "currentText": "9.1\",\n    \"dompurify\": \"3.4.17\",\n    \"@vercel/cli-config\": {\n      \"zod\": \"4.6.6\"\n    },\n    \"chromium-bidi\": {\n      \"zod\": \"4.6.6\"\n    },\n    \"eslint-plugin-react-hooks\": {\n      \"zod\": \"4.6.6\"\n    }",
            "previousText": "8.1\",\n    \"dompurify\": \"3.4.16\""
          }
        ]
      },
      {
        "path": "scripts/lib/plan-budget-current-ci-lineage.mjs",
        "status": "MODIFIED",
        "previousSha256": "57864fdf5e3ca44dbcb02c98b06f645300527b8d1b1b689928f7f8aa53e476db",
        "currentSha256": "30dc60ecb4f6aee0044a27d787508d47fa748febad177743c7ca585cd0a231d2",
        "previousBytes": 13887,
        "currentBytes": 35383,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 2033,
            "currentText": ",ownCompiled=null;\nconst OWN_KEY='ownRuntimeDiagnosticAdvance',OWN_BASE_CONTRACT='75140c878ebd4792bf59da6aa4dbc0f2db082963c8518acf867cffc7f78f5ac0',OWN_BASE_REVIEWED='f0c0c1e40171f3ed6d2af16bed2504eaf640ce9dff9995b33bd4c76d90b664da';\nconst OWN_SOURCE_PATHS=[\"package-lock.json\",\"package.json\",\"scripts/lib/plan-budget-current-ci-lineage.mjs\",\"scripts/verify-field-task-pagination-ci.mjs\",\"scripts/verify-focused-workspace-ci.mjs\",\"scripts/verify-own-company-number-ui.mjs\",\"scripts/verify-own-company-templates-ui.mjs\",\"src/app/(identity)/cuenta/own-company-number-panel.js\",\"src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs\",\"src/lib/company-channel-http.mjs\",\"src/lib/company-channel-store.mjs\",\"src/lib/meta-customer-provider.mjs\",\"src/lib/meta-own-company-connection.mjs\",\"tests/fixtures/own-runtime-diagnostic.mjs\",\"tests/production-dependencies.test.mjs\",\"tests/production-material-review-current-ci-lineage.test.mjs\",\"tests/production-meta-existing-api-plan-current-ci-lineage.test.mjs\",\"tests/production-own-company-runtime-diagnostic-view.test.mjs\",\"tests/production-own-company-runtime-diagnostic.test.mjs\",\"tests/production-own-company-runtime-provider.test.mjs\",\"tests/production-own-runtime-source-advance.test.mjs\",\"tests/production-participant-preanalysis-current-ci-lineage.test.mjs\",\"tests/production-whatsapp-field-continuity-current-ci-lineage.test.mjs\"],OWN_PREVIOUS_MANIFEST='3fed23069ec78275972146f9fe0be8562114ccfb47660d2333e815f0877eb0c3';\nconst OWN_VIEW='src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs';\nconst OWN_RETAINED_DEPENDENCIES=[{\"path\":\"src/app/(identity)/cuenta/kyc-camera-session.mjs\",\"sha256\":\"e84404979093aaad5179cf47433b3930ddc71e7677fe36db6018fcd49bf8e5c4\",\"bytes\":4136,\"previousMetadataSha256\":null,\"metadataPins\":[]},{\"path\":\"src/app/(identity)/cuenta/kyc-photo-preparation.js\",\"sha256\":\"d88c55b9fb97b6b1abb5ecb02cf66b9d8e016821525f1b6a3cc2a381e641c4e5\",\"bytes\":12504,\"previousMetadataSha256\":\"88137686826cc411d6fcc103b0085390c0cc16f69572cf45c2385bcde69f943d\",\"metadataPins\":[\"794999ccbafafb029c85a94f946eaa6f3e126a8642db47f1df9f1f0ddee1ce3d\",\"88137686826cc411d6fcc103b0085390c0cc16f69572cf45c2385bcde69f943d\"]},{\"path\":\"src/app/(identity)/cuenta/participant-kyc-capture.js\",\"sha256\":\"556109c32d2f85be4b043513362d682ed7e14811a21a6f08200ac65c53af5d48\",\"bytes\":4864,\"previousMetadataSha256\":\"83ee427bbbecbf74aee901fd77c6981232a2cd07e235180566938c2c0201647d\",\"metadataPins\":[\"83ee427bbbecbf74aee901fd77c6981232a2cd07e235180566938c2c0201647d\"]},{\"path\":\"src/app/(identity)/cuenta/participant-panel.js\",\"sha256\":\"1ec30c252d7f0fa8d65905f66eeca76da1644778b9ad710da5487ab667759c82\",\"bytes\":106608,\"previousMetadataSha256\":\"a9d5934c7bda61c49362ac53cfb339a5d66497566f71415ecc4621686ce17519\",\"metadataPins\":[\"4e10ff5f05942b9704f247e13972968cc2a441b6ba09bca277694e85a94cd56e\",\"a9d5934c7bda61c49362ac53cfb339a5d66497566f71415ecc4621686ce17519\",\"d16ee3ba394be011c5d338599d01653eec7d462705a2414821e02db3b44e38aa\"]},{\"path\":\"src/app/(identity)/cuenta/participant-panel.module.css\",\"sha256\":\"31ef143f21af5f6ed0aba4f11bf1cf79549ae97c462ed0bef2daaf3e67635250\",\"bytes\":6728,\"previousMetadataSha256\":\"c1626d1a678f1060b1ccb9df106f32b041da2c3b2bd92ede3e65537aaf794c02\",\"metadataPins\":[\"3f8f1ff1a2a95dc0288e8b9877f1260753944f8a7fa075a96baf8b5a1e92a1fa\",\"c1626d1a678f1060b1ccb9df106f32b041da2c3b2bd92ede3e65537aaf794c02\"]},{\"path\":\"src/app/(identity)/cuenta/workspace-client.js\",\"sha256\":\"f9acac2e8589afce076c51e07ef2bd4c3a67360faa9970b2cbbd447502c98bc0\",\"bytes\":75429,\"previousMetadataSha256\":\"2fe5a56a7caf7d46f11e4292d2e145e3e72072198a09f9951ace42c2613e8db9\",\"metadataPins\":[\"2fe5a56a7caf7d46f11e4292d2e145e3e72072198a09f9951ace42c2613e8db9\",\"4143cf960157d8bd5f642842ee1672a3555c0e415c3dc4579763e2e8eabf84fb\",\"4f3ccde7f433c98e63f0ada92cd1346f0757bea06ea8bf93abf9ac0ff62b79f8\",\"75ae3226996571c43e5a03f47df2241dc28425a00b804f8eb86600b0ea528858\",\"7f9612e2f92d582b1318c39d542060a9ab3d41df72e20511d659235601f10cb8\",\"943f71658a65f113b98ba4e900be95e1020858ba4d85a4431f1a51926ef597fa\",\"e53ad474a3677243fbcaff6ce526c0983514d42e78c6daf60e73ba06d6f63bec\"]}],OWN_SOURCE_SET_ADVANCES=[{\"family\":\"UI_BANK\",\"pointer\":\"/extension/proofs/3/sourceFiles\",\"additions\":[\"src/app/(identity)/cuenta/kyc-camera-session.mjs\"]},{\"family\":\"UI_IDENTITY_ONLY\",\"pointer\":\"/extension/proofs/13/sourceFiles\",\"additions\":[\"src/app/(identity)/cuenta/kyc-camera-session.mjs\",\"src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs\"]},{\"family\":\"PG_PARTICIPANT_KYC_PREANALYSIS\",\"pointer\":\"/extension/proofs/18/sourceFiles\",\"additions\":[\"src/app/(identity)/cuenta/kyc-camera-session.mjs\"]},{\"family\":\"UI_FOCUSED_WORKSPACE\",\"pointer\":\"/extension/proofs/19/sourceFiles\",\"additions\":[\"src/app/(identity)/cuenta/kyc-camera-session.mjs\",\"src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs\"]},{\"family\":\"LIVE_HOURS_RUNTIME\",\"pointer\":\"/planBudgetCurrentRevision/sourceFamilies/0/currentFiles\",\"additions\":[\"src/app/(identity)/cuenta/kyc-camera-session.mjs\",\"src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs\"]}];\nconst OWN_RETAINED_CAMERA=OWN_RETAINED_DEPENDENCIES.find(row=>row.path.endsWith('/kyc-camera-session.mjs')),OWN_PRODUCER_ADVANCES=[{\"pointer\":\"/extension/proofs/19/producerSha256\",\"path\":\"scripts/verify-focused-workspace-ci.mjs\"},{\"pointer\":\"/extension/proofs/20/producerSha256\",\"path\":\"scripts/verify-field-task-pagination-ci.mjs\"},{\"pointer\":\"/evidenceProducers/72/producerSha256\",\"path\":\"scripts/verify-focused-workspace-ci.mjs\"},{\"pointer\":\"/evidenceProducers/73/producerSha256\",\"path\":\"scripts/verify-field-task-pagination-ci.mjs\"}];\nconst OWN_FAMILY_ADDITIONS={0:[OWN_VIEW,OWN_RETAINED_CAMERA.path].sort(),4:[OWN_VIEW,OWN_RETAINED_CAMERA.path].sort()};\nfunction ownPointer(value,p){reject(typeof p==='string'&&p.startsWith('/'),'OWN_POINTER');const keys=p.slice(1).split('/');let owner=value;for(const k of keys.slice(0,-1)){reject(plain(owner)||Array.isArray(owner),'OWN_POINTER');reject(Object.hasOwn(owner,k),'OWN_POINTER');owner=owner[k];}const key=keys.at(-1);reject(Object.hasOwn(owner,key),'OWN_POINTER');return{owner,key,value:owner[key]};}\nfunction ownCheckHunks(hunks){let end=0;reject(Array.isArray(hunks)&&hunks.length>0,'OWN_SOURCE_INVERSE');for(const h of hunks){exact(h,['currentOffsetCharacters','currentText','previousText'],'OWN_SOURCE_HUNK');reject(Number.isSafeInteger(h.currentOffsetCharacters)&&h.currentOffsetCharacters>=end&&typeof h.currentText==='string'&&typeof h.previousText==='string','OWN_SOURCE_HUNK');end=h.currentOffsetCharacters+h.currentText.length;}}\nfunction ownInverseText(text,hunks){ownCheckHunks(hunks);for(const h of [...hunks].reverse()){reject(text.slice(h.currentOffsetCharacters,h.currentOffsetCharacters+h.currentText.length)===h.currentText,'OWN_SOURCE_HUNK_MATCH');text=text.slice(0,h.currentOffsetCharacters)+h.previousText+text.slice(h.currentOffsetCharacters+h.currentText.length);}return text;}\nfunction ownNormalize(value,patches,onlySection=false){const out=structuredClone(value);if(onlySection)delete out[OWN_KEY];else delete out[PLAN_BUDGET_CURRENT_SECTION][OWN_KEY];for(const patch of [...patches].reverse()){const prefix='/'+PLAN_BUDGET_CURRENT_SECTION+'/';if(onlySection&&!patch.pointer.startsWith(prefix))continue;const p=onlySection?patch.pointer.slice(prefix.length-1):patch.pointer,at=ownPointer(out,p);reject(same(at.value,patch.after),'OWN_METADATA_CURRENT');at.owner[at.key]=structuredClone(patch.before);}return out;}\nfunction ownState(){\n if(!Object.hasOwn(expected,OWN_KEY))return null;if(ownCompiled)return ownCompiled;const a=expected[OWN_KEY];\n exact(a,['version','kind','previousContractSha256','previousReviewedSha256','sourceChanges','retainedDependencies','metadataInverse'],'OWN_ADVANCE_KEYS');reject(a.version===1&&a.kind==='OWN_RUNTIME_DIAGNOSTIC_SOURCE_ADVANCE'&&a.previousContractSha256===OWN_BASE_CONTRACT&&a.previousReviewedSha256===OWN_BASE_REVIEWED,'OWN_ADVANCE_ANCHOR');\n reject(Array.isArray(a.sourceChanges)&&same(a.sourceChanges.map(s=>s.path),OWN_SOURCE_PATHS),'OWN_SOURCE_PATHS');const sources=new Map();\n for(const s of a.sourceChanges){exact(s,['path','status','previousSha256','currentSha256','previousBytes','currentBytes','inverseHunks'],'OWN_SOURCE_KEYS');reject(safe(s.path)&&hash(s.currentSha256)&&Number.isSafeInteger(s.currentBytes)&&s.currentBytes>0&&Number.isSafeInteger(s.previousBytes)&&s.previousBytes>=0,'OWN_SOURCE_PIN');reject(s.status==='ADDED'?s.previousSha256===null&&s.previousBytes===0:s.status==='MODIFIED'&&hash(s.previousSha256)&&s.previousBytes>0,'OWN_SOURCE_STATUS');ownCheckHunks(s.inverseHunks);sources.set(s.path,s);}\n reject(sha(JSON.stringify(a.sourceChanges.map(s=>({path:s.path,sha256:s.previousSha256,bytes:s.previousBytes}))))===OWN_PREVIOUS_MANIFEST,'OWN_PREVIOUS_MANIFEST');\n reject(Array.isArray(a.metadataInverse)&&a.metadataInverse.length>0,'OWN_METADATA_INVERSE');const pointers=[];for(const p of a.metadataInverse){exact(p,['pointer','before','after'],'OWN_METADATA_PATCH');reject(typeof p.pointer==='string'&&!same(p.before,p.after)&&!pointers.some(q=>q===p.pointer||q.startsWith(p.pointer+'/')||p.pointer.startsWith(q+'/')),'OWN_METADATA_POINTER');pointers.push(p.pointer);}\n for(const p of ['/packageLockSha256',...OWN_PRODUCER_ADVANCES.map(row=>row.pointer),...OWN_SOURCE_SET_ADVANCES.map(row=>row.pointer),'/planBudgetCurrentRevision/sourceFamilies/0/currentManifest','/planBudgetCurrentRevision/sourceFamilies/4/currentFiles','/planBudgetCurrentRevision/sourceFamilies/4/currentManifest'])reject(pointers.includes(p),'OWN_REQUIRED_METADATA_PATCH');\n reject(same(a.retainedDependencies,OWN_RETAINED_DEPENDENCIES)&&a.retainedDependencies.every(row=>!sources.has(row.path)),'OWN_RETAINED_DEPENDENCY');const retained=new Map(a.retainedDependencies.map(row=>[row.path,row]));\n const prior=ownNormalize(expected,a.metadataInverse,true);reject(sha(declaration(prior))===OWN_BASE_REVIEWED,'OWN_WHOLE_REVIEWED_INVERSE');\n for(const p of a.metadataInverse){const family=/^\\/planBudgetCurrentRevision\\/sourceFamilies\\/(\\d+)\\/(currentFiles|currentManifest)(?:\\/(\\d+)\\/sha256)?$/.exec(p.pointer);\n  if(p.pointer==='/packageLockSha256'){const s=sources.get('package-lock.json');reject(p.before===s.previousSha256&&p.after===s.currentSha256,'OWN_LOCK_PATCH');continue;}\n  const producerAdvance=OWN_PRODUCER_ADVANCES.find(row=>row.pointer===p.pointer);if(producerAdvance){const s=sources.get(producerAdvance.path);reject(s&&p.before===s.previousSha256&&p.after===s.currentSha256,'OWN_PRODUCER_PIN_ADVANCE');continue;}\n  const proofAdvance=OWN_SOURCE_SET_ADVANCES.find(row=>row.pointer===p.pointer&&p.pointer.startsWith('/extension/'));if(proofAdvance){sorted(p.before);reject(proofAdvance.additions.every(file=>!p.before.includes(file))&&same(p.after,[...p.before,...proofAdvance.additions].sort()),'OWN_UI_PROOF_ADVANCE');continue;}\n  reject(Boolean(family),'OWN_METADATA_POINTER');const index=Number(family[1]),field=family[2],sourceIndex=family[3];reject(prior.sourceFamilies[index],'OWN_METADATA_FAMILY');\n  if(sourceIndex!==undefined){reject(field==='currentManifest'&&index!==0&&index!==4,'OWN_METADATA_MANIFEST');const ref=prior.sourceFamilies[index].currentManifest[Number(sourceIndex)],s=sources.get(ref?.path),r=retained.get(ref?.path);reject(s?p.before===s.previousSha256&&p.after===s.currentSha256:Boolean(r)&&p.before===ref.sha256&&p.after===r.sha256,'OWN_METADATA_SOURCE_PIN');}\n  else{const additions=OWN_FAMILY_ADDITIONS[index];reject(Boolean(additions),'OWN_UI_FAMILY_ADVANCE');if(field==='currentFiles')reject(additions.every(file=>!p.before.includes(file))&&same(p.after,[...p.before,...additions].sort()),'OWN_UI_FAMILY_ADVANCE');else{const refs=p.before.map(ref=>({...ref,sha256:sources.get(ref.path)?.currentSha256??retained.get(ref.path)?.sha256??ref.sha256}));for(const file of additions)refs.push({path:file,sha256:sources.get(file)?.currentSha256??retained.get(file)?.sha256});refs.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);reject(same(p.after,refs),'OWN_UI_MANIFEST_ADVANCE');}}\n }\n for(const family of expected.sourceFamilies)for(const ref of family.currentManifest){const s=sources.get(ref.path),r=retained.get(ref.path);if(s||r)reject(ref.sha256===(s?.currentSha256??r.sha256),'OWN_CURRENT_MANIFEST_JOIN');}\n for(const ref of prior.references){const s=sources.get(ref.path);if(s)reject(ref.currentSha256===s.previousSha256,'OWN_REFERENCE_CHAIN_JOIN');}\n ownCompiled={advance:a,previousQ:prior,sources,retained};return ownCompiled;\n}\nfunction ownActive(contract){return plain(contract?.[PLAN_BUDGET_CURRENT_SECTION])&&Object.hasOwn(contract[PLAN_BUDGET_CURRENT_SECTION],OWN_KEY);}\nfunction ownPreviousContract(contract){const state=ownState();if(!state||!ownActive(contract))return contract;const out=ownNormalize(contract,state.advance.metadataInverse);reject(sha(JSON.stringify(out,null,2)+'\\n')===OWN_BASE_CONTRACT,'OWN_WHOLE_CONTRACT_INVERSE');return out;}\nconst OWN_CI_HISTORICAL_PINS=[{\"path\":\"scripts/verify-focused-workspace-ci.mjs\",\"baselineSha256\":\"532e37e994540a6fecd8c70d067730cddec4a66403686113cef4087828c2229c\",\"pins\":[\"3b9c0a1fa09e4cdd7eb731270d18c36e5f2bfbf480aa156447f3d02048a8a92d\",\"48650c362bfc0b9d8fd49976fbc4ae1a124776167c60ba08f60d2b163ee94e24\",\"a4eb59cb781eeb9578e46ffcdec21833cce1ba79eb9f99e3543fda799dfc62f4\",\"b7d134ed370e7984f8aed315127b82e4d2bdebe20a6d0d79a7453bf7e1f63dab\"]},{\"path\":\"scripts/verify-field-task-pagination-ci.mjs\",\"baselineSha256\":\"1e366a583be909323327524a8fe04db9eb962724ec5073bdf3eb36140ddcdecc\",\"pins\":[\"fe25cce6cecd014c923852c09f7eccb9431efd33805eb8bbad03bea79997a94d\"]}],OWN_PHONE_PREVIOUS_PIN={\"path\":\"src/lib/meta-customer-provider.mjs\",\"sha256\":\"131ddc2c6344bc1e58a6ea17aa665f9e8585a0aabee7300eaa050c06ab85470a\",\"baselineSha256\":\"102ae45ad7d0a1054d2c65cdbfa3a6a96accfcd982bebce8d6c32c7bf24b21a2\"};\nconst OWN_TEST_PREVIOUS_PINS=[{\"path\":\"tests/production-material-review-current-ci-lineage.test.mjs\",\"baselineSha256\":\"cd3f36d1a26c2b2c82a27537566b9221245a6747012bf9e641fc8c0d73ea565e\",\"previousPairSha256\":\"a9d434e05848d2d2170d57a9410c8ddeecf4585949a645cb1fdf0480b2e58db9\",\"pins\":[\"09507a383397841240acc1a800da5fda19f2bab4a6e9f803ec73c37aa307f9f5\",\"3064ebedd2ab050d4d2e1326643d9b4d83d699a3a1f08489fe89b1bfadf45069\",\"38012a323a305bd8e41dcc04bc698b50dcac04110cec2cb7db93c8fa0f1e7ffa\",\"d4ff4dd321b7e7499cd2aed817abc0f5aab47b94e38d9d88c72d694d1768b0a1\"]},{\"path\":\"tests/production-meta-existing-api-plan-current-ci-lineage.test.mjs\",\"baselineSha256\":\"00d21d855c36f8020bd1791ed3b48b90901f7e017c0611d2df33a3a13ab1978d\",\"previousPairSha256\":\"dabe6caf8e2a216aa1d7160551431ce3e3b198b09b397f8c10edfeb9d9928650\",\"pins\":[\"6559fc99b2e4c40762b8b3a9dfbb6b542847ac08ab54d39e7461035e33b513f2\",\"ab3984d2393131261baa298b9408394b695cbca9f8e06d54ddac563c20c41587\",\"b321b7dfb5c82333883f2008b5dfe9e00b6d8aba31c920bd3484e397bf5dd1ed\"]},{\"path\":\"tests/production-participant-preanalysis-current-ci-lineage.test.mjs\",\"baselineSha256\":\"ea91b9b98adffaf408f85d60982577ba4befe044fa3d0f1a34c0d1daa017c574\",\"previousPairSha256\":\"568a07b2a88be7c9a0f217ce2b49fc61dbdeca8d6d1891dc63d0752f0efff9b4\",\"pins\":[\"12e14b7574906a4492b73437feea48478e2e05447456fdd7fbbce11eb61a5fa5\",\"6cb2d234dd3eee662cab7d713da8477c9c4933f176b519ee3f456c0619cccaca\",\"b509f96f600364d0327b4d3c2ac411fc2b32137b5e38fb4c2d47e3bf046cbd06\",\"c6fd915fe04bd3ee48c9490c8e1e43e8ad44f0d2597bf1675c79e8db6880dd46\"]},{\"path\":\"tests/production-whatsapp-field-continuity-current-ci-lineage.test.mjs\",\"baselineSha256\":\"a0e817f4f0ea3bae2a8042447a38ad099fb448a9ec8d34c0fd8e0b754685a497\",\"previousPairSha256\":\"43e1b60497a81d1598674fc3500b8ed47fa9be807c03788641ff5cf12c129521\",\"pins\":[\"15c2404c6ae43b86207f8e26915e642c6b1efa752e579e59d76fc50655e14b9b\",\"63d8b5b1c3e8f3f38add5c66b0901ea4477a7e7c9eb394ed6f02a4a4ee2b8acb\",\"6e8a12fc32a3eb57f146d31788ff2a2c8396f72763953e7ee0d9e76a4c896c71\",\"d55968747a2bfc23f02de49d0418374665e2db7e156cfa0356c21145cc9c83b4\"]}];\nfunction ownHistoricalInputPins(contract,file){if(!ownActive(contract))return[];const state=ownState(),row=OWN_CI_HISTORICAL_PINS.find(row=>row.path===file);if(row){reject(state.sources.get(file)?.previousSha256===row.baselineSha256,'OWN_HISTORICAL_CI_BASE');return row.pins;}if(file===OWN_PHONE_PREVIOUS_PIN.path){const source=state.sources.get(file),legacy=state.previousQ.references.find(row=>row.path===file);reject(source?.previousSha256===OWN_PHONE_PREVIOUS_PIN.baselineSha256&&legacy?.currentSha256===source.previousSha256,'OWN_HISTORICAL_PHONE_BASE');return[OWN_PHONE_PREVIOUS_PIN.sha256];}const test=OWN_TEST_PREVIOUS_PINS.find(row=>row.path===file);if(test){const source=state.sources.get(file),legacy=state.previousQ.references.find(row=>row.path===file);reject(source?.previousSha256===test.baselineSha256&&legacy?.currentSha256===test.baselineSha256&&legacy?.previousSha256===test.previousPairSha256,'OWN_HISTORICAL_TEST_BASE');return test.pins;}return[];}\nfunction ownCurrentPin(contract,file,value){const state=ownActive(contract)?ownState():null,s=state?.sources.get(file),r=state?.retained.get(file);if(r){reject(value===r.sha256||r.metadataPins.includes(value),'OWN_RETAINED_PIN_JOIN');return r.sha256;}if(!s)return value;reject(value===s.previousSha256||value===s.currentSha256||OWN_CI_HISTORICAL_PINS.some(row=>row.path===file)&&ownHistoricalInputPins(contract,file).includes(value),'OWN_CURRENT_PIN_JOIN');return s.currentSha256;}\nfunction ownInputPin(contract,file,value){const state=ownActive(contract)?ownState():null,s=state?.sources.get(file),r=state?.retained.get(file);if(r){reject(value===r.sha256||r.metadataPins.includes(value),'OWN_RETAINED_PIN_JOIN');if(value===r.sha256&&r.previousMetadataSha256!==null)return r.previousMetadataSha256;}if(s){const legacy=state.previousQ.references.find(r=>r.path===file);reject([s.currentSha256,s.previousSha256,legacy?.previousSha256].filter(v=>v!==null&&v!==undefined).includes(value)||ownHistoricalInputPins(contract,file).includes(value),'OWN_SOURCE_PIN_JOIN');}return s&&value===s.currentSha256?s.previousSha256:value;}\nfunction ownCurrentFamily(contract,family){return ownActive(contract)?expected.sourceFamilies.find(row=>row.family===family):compile().families.get(family);}\nfunction ownUiSources(family,files){const state=ownState();if(!state)return{files,added:[]};const row=OWN_SOURCE_SET_ADVANCES.find(row=>row.family===family),patch=state.advance.metadataInverse.find(p=>p.pointer===row?.pointer);return patch&&same(files,patch.after)?{files:patch.before,added:[...row.additions]}:{files,added:[]};}\nfunction ownVerifySources(contract,readSource,active=ownActive(contract)){const state=ownState();if(!state||!active)return[];const rows=[];for(const s of state.advance.sourceChanges){let raw;try{raw=readSource(s.path);}catch{}reject(Buffer.isBuffer(raw)&&raw.equals(Buffer.from(raw.toString('utf8'))),'OWN_SOURCE_BYTES_'+s.path);const normalized=raw.toString('utf8').replaceAll('\\r\\n','\\n');reject(Buffer.byteLength(normalized)===s.currentBytes&&sha(normalized)===s.currentSha256,'OWN_SOURCE_CURRENT_'+s.path);const prior=ownInverseText(normalized,s.inverseHunks);reject(Buffer.byteLength(prior)===s.previousBytes&&(s.previousSha256===null?prior==='':sha(prior)===s.previousSha256),'OWN_SOURCE_PREVIOUS_'+s.path);rows.push({path:s.path,raw:Buffer.from(raw)});}for(const r of state.advance.retainedDependencies){let raw;try{raw=readSource(r.path);}catch{}reject(Buffer.isBuffer(raw)&&raw.equals(Buffer.from(raw.toString('utf8'))),'OWN_RETAINED_BYTES_'+r.path);const normalized=raw.toString('utf8').replaceAll('\\r\\n','\\n');reject(Buffer.byteLength(normalized)===r.bytes&&sha(normalized)===r.sha256,'OWN_RETAINED_CURRENT_'+r.path);rows.push({path:r.path,raw:Buffer.from(raw)});}return rows;}\nfunction ownSourceFrame(contract,readSource,run){const active=ownActive(contract),beforeMetadata=JSON.stringify(contract),before=ownVerifySources(contract,readSource,active);try{return run();}finally{let after,failure;try{after=ownVerifySources(contract,readSource,active);}catch(error){failure=error;}reject(JSON.stringify(contract)===beforeMetadata,'OWN_CALLER_METADATA_CHANGED');if(failure)throw failure;reject(before.length===after.length&&before.every((row,i)=>row.path===after[i].path&&row.raw.equals(after[i].raw)),'OWN_SOURCE_CHANGED_DURING_CALL');}}\n",
            "previousText": ";"
          },
          {
            "currentOffsetCharacters": 22279,
            "currentText": "ownState()?.previousQ??",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 28039,
            "currentText": "expected",
            "previousText": "v"
          },
          {
            "currentOffsetCharacters": 28272,
            "currentText": "if(same(contract[PLAN_BUDGET_CURRENT_SECTION],expected))return expected;const own=ownState();reject(own&&same(contract[PLAN_BUDGET_CURRENT_SECTION],own.previousQ)&&sha(JSON.stringify(contract,null,2)+'\\n')===OWN_BASE_CONTRACT,'IMMUTABLE_COMPANION');return own.previousQ",
            "previousText": "reject(same(contract[PLAN_BUDGET_CURRENT_SECTION],expected),'IMMUTABLE_COMPANION');return expected"
          },
          {
            "currentOffsetCharacters": 28965,
            "currentText": "// Readonly whole-own projection; physical current authority is authenticated before returning0707 metadata.\nexport function restoreOwnRuntimeDiagnosticPreviousContract(contract,readSource){section(contract,true);reject(ownActive(contract),'OWN_ADVANCE_REQUIRED');return ownSourceFrame(contract,readSource,()=>{verifyPlanBudgetCurrentSources(contract,readSource);return ownPreviousContract(contract);});}\n",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 29506,
            "currentText": "ownPreviousContract(contract)",
            "previousText": "contract"
          },
          {
            "currentOffsetCharacters": 30985,
            "currentText": "input=ownInputPin(contract,ref.path,ref.sha256),row=compile().refs.get(ref.path);if(row)reject([row.previousSha256,row.currentSha256].filter(Boolean).includes(input),'EXACT_PREVIOUS_CURRENT_PIN_'+ref.path);return ownCurrentPin(contract,ref.path,row?row.currentSha256:input);}\nexport function planBudgetPreviousSourcePin(contract,ref){if(!plain(contract)||!Object.hasOwn(contract,PLAN_BUDGET_CURRENT_SECTION))return ref.sha256;const input=ownInputPin(contract,ref.path,ref.sha256),row=compile().refs.get(ref.path);return row?.previousSha256&&input===row.currentSha256?row.previousSha256:input;}\nexport function restorePlanBudgetSourceSet(contract,family,files){if(!section(contract))return files;const row=compile().sets.get(family);if(!row)return files;sorted(files);if(ownActive(contract))files=ownUiSources(family,files).files;if(files.length===row.previousCount&&sha(JSON.stringify(files))===row.previousPathsSha256)return [...files];return previousFiles(files,row);}\nexport function planBudgetProofSourceAdditions(spec){const row=compile().sets.get(spec?.kind);if(!row)return[];sorted(spec.sourceFiles);const owned=ownUiSources(spec.kind,spec.sourceFiles),files=owned.files;if(files.length===row.currentCount&&sha(JSON.stringify(files))===row.currentPathsSha256){previousFiles(files,row);return [...row.additions,...owned.added].sort();}if(files.length===row.previousCount&&sha(JSON.stringify(files))===row.previousPathsSha256)return[];reject(files.length<row.previousCount&&!row.additions.some(file=>files.includes(file)),'UNKNOWN_EARLIER_SOURCE_SET');return[];}\nexport function verifyPlanBudgetCurrentSources(contract,readSource){const v=section(contract,true);return ownSourceFrame(contract,readSource,()=>{restorePlanBudgetPreviousContract(contract);reject(read(readSource,anchor).toString()===(ownActive(contract)?compile().text:declaration(v)),'DECLARATION_BYTES');for(const row of v.references)reject(sha(read(readSource,row.path))===ownCurrentPin(contract,row.path,row.currentSha256),'CURRENT_SOURCE_'+row.path);return {completePreviousContractRestored:true,previousContractSha256:previousHash,referenceCount:v.references.length,nativeOrBrowserAcceptance:false};});}\nexport function verifyPlanBudgetActualClosure(contract,family,closure,readSource){section(contract,true);return ownSourceFrame(contract,readSource,()=>{restorePlanBudgetPreviousContract(contract);const row=ownCurrentFamily(contract,family);reject(Boolean(row),'EXPLICIT_FAMILY');exact(closure,['files','externalImports'],'CLOSURE_KEYS');reject(same(closure.files,row.currentFiles)&&same(closure.externalImports,row.externalImports),'EXACT_CURRENT_CLOSURE');for(const ref of row.currentManifest){const bytes=read(readSource,ref.path);reject(ref.path===anchor?bytes.toString()===(ownActive(contract)?compile().text:declaration(section(contract,true))):sha(bytes)===ref.sha256,'CURRENT_FAMILY_SOURCE_'+ref.path);}return {family,sourceCount:row.currentFiles.length,sourcePathsSha256:sha(JSON.stringify(row.currentFiles)),nativeOrBrowserAcceptance:false};});}\nexport function restorePlanBudgetClosure(contract,family,closure){if(!section(contract))return closure;const row=ownCurrentFamily(contract,family);reject(Boolean(row),'EXPLICIT_FAMILY');reject(same(closure.files,row.currentFiles)&&same(closure.externalImports,row.externalImports),'EXACT_CURRENT_CLOSURE');const previous=compile().families.get(family);return {files:[...previous.previousFiles],externalImports:[...previous.previousExternalImports]};}\nexport function planBudgetValidationFiles(contract){const v=section(contract);return v?[...new Set([anchor,...v.references.map(row=>row.path),...(ownActive(contract)?[...ownState().advance.sourceChanges.map(row=>row.path),...ownState().advance.retainedDependencies.map(row=>row.path)]:[])]",
            "previousText": "row=compile().refs.get(ref.path);if(!row)return ref.sha256;reject([row.previousSha256,row.currentSha256].filter(Boolean).includes(ref.sha256),'EXACT_PREVIOUS_CURRENT_PIN_'+ref.path);return row.currentSha256;}\nexport function planBudgetPreviousSourcePin(contract,ref){if(!plain(contract)||!Object.hasOwn(contract,PLAN_BUDGET_CURRENT_SECTION))return ref.sha256;const row=compile().refs.get(ref.path);return row?.previousSha256&&ref.sha256===row.currentSha256?row.previousSha256:ref.sha256;}\nexport function restorePlanBudgetSourceSet(contract,family,files){if(!section(contract))return files;const row=compile().sets.get(family);if(!row)return files;sorted(files);if(files.length===row.previousCount&&sha(JSON.stringify(files))===row.previousPathsSha256)return [...files];return previousFiles(files,row);}\nexport function planBudgetProofSourceAdditions(spec){const row=compile().sets.get(spec?.kind);if(!row)return[];sorted(spec.sourceFiles);const files=spec.sourceFiles;if(files.length===row.currentCount&&sha(JSON.stringify(files))===row.currentPathsSha256){previousFiles(files,row);return [...row.additions];}if(files.length===row.previousCount&&sha(JSON.stringify(files))===row.previousPathsSha256)return[];reject(files.length<row.previousCount&&!row.additions.some(file=>files.includes(file)),'UNKNOWN_EARLIER_SOURCE_SET');return[];}\nexport function verifyPlanBudgetCurrentSources(contract,readSource){const v=section(contract,true);restorePlanBudgetPreviousContract(contract);reject(read(readSource,anchor).toString()===compile().text,'DECLARATION_BYTES');for(const row of v.references)reject(sha(read(readSource,row.path))===row.currentSha256,'CURRENT_SOURCE_'+row.path);return {completePreviousContractRestored:true,previousContractSha256:previousHash,referenceCount:v.references.length,nativeOrBrowserAcceptance:false};}\nexport function verifyPlanBudgetActualClosure(contract,family,closure,readSource){section(contract,true);restorePlanBudgetPreviousContract(contract);const row=compile().families.get(family);reject(Boolean(row),'EXPLICIT_FAMILY');exact(closure,['files','externalImports'],'CLOSURE_KEYS');reject(same(closure.files,row.currentFiles)&&same(closure.externalImports,row.externalImports),'EXACT_CURRENT_CLOSURE');for(const ref of row.currentManifest){const bytes=read(readSource,ref.path);reject(ref.path===anchor?bytes.toString()===compile().text:sha(bytes)===ref.sha256,'CURRENT_FAMILY_SOURCE_'+ref.path);}return {family,sourceCount:row.currentFiles.length,sourcePathsSha256:sha(JSON.stringify(row.currentFiles)),nativeOrBrowserAcceptance:false};}\nexport function restorePlanBudgetClosure(contract,family,closure){if(!section(contract))return closure;const row=compile().families.get(family);reject(Boolean(row),'EXPLICIT_FAMILY');reject(same(closure.files,row.currentFiles)&&same(closure.externalImports,row.externalImports),'EXACT_CURRENT_CLOSURE');return {files:[...row.previousFiles],externalImports:[...row.previousExternalImports]};}\nexport function planBudgetValidationFiles(contract){const v=section(contract);return v?[anchor,...v.references.map(row=>row.path"
          }
        ]
      },
      {
        "path": "scripts/verify-field-task-pagination-ci.mjs",
        "status": "MODIFIED",
        "previousSha256": "1e366a583be909323327524a8fe04db9eb962724ec5073bdf3eb36140ddcdecc",
        "currentSha256": "8839de070fd4629ebf676467232ea89149c328d92db095f6dd185b36090367ee",
        "previousBytes": 31564,
        "currentBytes": 33233,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 0,
            "currentText": "import {verifyPlanBudgetCurrentSources,planBudgetCurrentSourcePin} from './lib/plan-budget-current-ci-lineage.mjs';\n",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 5052,
            "currentText": "function withCurrentCompilerLock(readSource,legacyPin,run){\n let suppliedMetadata;try{suppliedMetadata=readSource(contractPath);}catch{return run({bytes:bytes(readSource,'package-lock.json'),sha256:legacyPin});}\n if(suppliedMetadata===null||suppliedMetadata===undefined)return run({bytes:bytes(readSource,'package-lock.json'),sha256:legacyPin});\n reject(Buffer.isBuffer(suppliedMetadata),'Compiler lock contract bytes required');const metadata=Buffer.from(suppliedMetadata);let contract;try{contract=JSON.parse(metadata);}catch{reject(false,'Compiler lock contract must parse');}reject(plain(contract),'Compiler lock contract object required');\n if(!Object.hasOwn(contract?.planBudgetCurrentRevision??{},'ownRuntimeDiagnosticAdvance'))return run({bytes:bytes(readSource,'package-lock.json'),sha256:legacyPin});\n const current=action=>{try{return action();}catch(error){if(error.code==='PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED')reject(false,error.message);throw error;}};\n current(()=>verifyPlanBudgetCurrentSources(contract,readSource));\n const before=Buffer.from(bytes(readSource,'package-lock.json')),wanted=current(()=>planBudgetCurrentSourcePin(contract,{path:'package-lock.json',sha256:legacyPin}));\n try{return run({bytes:before,sha256:wanted});}\n finally{current(()=>verifyPlanBudgetCurrentSources(contract,readSource));reject(bytes(readSource,contractPath).equals(metadata)&&bytes(readSource,'package-lock.json').equals(before),'Compiler lock or metadata RAW bytes changed during source inspection');}\n}\n",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 7115,
            "currentText": " return withCurrentCompilerLock(readSource,declaration.packageLockSha256,lock=>{\n",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 7317,
            "currentText": "lock.bytes)===lock.s",
            "previousText": "bytes(readSource,'package-lock.json'))===declaration.packageLockS"
          },
          {
            "currentOffsetCharacters": 7793,
            "currentText": " });\n",
            "previousText": ""
          }
        ]
      },
      {
        "path": "scripts/verify-focused-workspace-ci.mjs",
        "status": "MODIFIED",
        "previousSha256": "532e37e994540a6fecd8c70d067730cddec4a66403686113cef4087828c2229c",
        "currentSha256": "6ced258e2d012c26481f8f63e8d8bfbfc6011afd6a456f7d463b8aec94393621",
        "previousBytes": 35789,
        "currentBytes": 37458,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 0,
            "currentText": "import {verifyPlanBudgetCurrentSources,planBudgetCurrentSourcePin} from './lib/plan-budget-current-ci-lineage.mjs';\n",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 15280,
            "currentText": "function withCurrentCompilerLock(readSource,legacyPin,run){\n let suppliedMetadata;try{suppliedMetadata=readSource(contractPath);}catch{return run({bytes:bytes(readSource,'package-lock.json'),sha256:legacyPin});}\n if(suppliedMetadata===null||suppliedMetadata===undefined)return run({bytes:bytes(readSource,'package-lock.json'),sha256:legacyPin});\n reject(Buffer.isBuffer(suppliedMetadata),'Compiler lock contract bytes required');const metadata=Buffer.from(suppliedMetadata);let contract;try{contract=JSON.parse(metadata);}catch{reject(false,'Compiler lock contract must parse');}reject(plain(contract),'Compiler lock contract object required');\n if(!Object.hasOwn(contract?.planBudgetCurrentRevision??{},'ownRuntimeDiagnosticAdvance'))return run({bytes:bytes(readSource,'package-lock.json'),sha256:legacyPin});\n const current=action=>{try{return action();}catch(error){if(error.code==='PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED')reject(false,error.message);throw error;}};\n current(()=>verifyPlanBudgetCurrentSources(contract,readSource));\n const before=Buffer.from(bytes(readSource,'package-lock.json')),wanted=current(()=>planBudgetCurrentSourcePin(contract,{path:'package-lock.json',sha256:legacyPin}));\n try{return run({bytes:before,sha256:wanted});}\n finally{current(()=>verifyPlanBudgetCurrentSources(contract,readSource));reject(bytes(readSource,contractPath).equals(metadata)&&bytes(readSource,'package-lock.json').equals(before),'Compiler lock or metadata RAW bytes changed during source inspection');}\n}\n",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 17571,
            "currentText": "return withCurrentCompilerLock(readSource,declaration.packageLockSha256,lock=>{\n const canonicalHash=raw=>sha(Buffer.from(raw.toString('utf8').replaceAll('\\r\\n','\\n')));reject(canonicalHash(value)===declaration.sourceLfSha256&&canonicalHash(lock.bytes)===lock.s",
            "previousText": "const canonicalHash=raw=>sha(Buffer.from(raw.toString('utf8').replaceAll('\\r\\n','\\n')));reject(canonicalHash(value)===declaration.sourceLfSha256&&canonicalHash(bytes(readSource,'package-lock.json'))===declaration.packageLockS"
          },
          {
            "currentOffsetCharacters": 18536,
            "currentText": " });\n",
            "previousText": ""
          }
        ]
      },
      {
        "path": "scripts/verify-own-company-number-ui.mjs",
        "status": "MODIFIED",
        "previousSha256": "43e41b2ceaf373283110a35b5edf3d4d0a1e234079476d4e66a7c8066eadc162",
        "currentSha256": "8e72a53c121cbc097ed7334fd7ea4b9aa08eb602d50cd84d0ac730e0aa1785aa",
        "previousBytes": 34090,
        "currentBytes": 41778,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 1093,
            "currentText": "runtime-diagnostic-view.mjs','own-company-",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 6908,
            "currentText": ",'stored-runtime-diagnostic-passed','stored-runtime-diagnostic-rejected','stored-runtime-diagnostic-stale-reference'",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 12597,
            "currentText": ",diagnosticMode=mode.startsWith('stored-runtime-diagnostic-'),diagnosticQueries=[],diagnosticObservedAt='2026-10-24T12:34:56.000Z',diagnosticCheckedAt='2026-10-24T12:34:57.000Z';let channel=mode==='activation-unknown'?{id:'own-channel',anchorProjectId:'project-a',revision:2,mode:'PREPARED',displayPhoneNumber:'+54 911 0000 9999',connectionStatus:'PENDING',enabled:false}:runtimeMode||storedMode?{id:'own-channel',anchorProjectId:'project-a',revision:4,mode:mode==='runtime-revoked'?'SUSPENDED':'COMPANY',displayPhoneNumber:'+54 911 0000 9999',connectionStatus:'CONNECTED',enabled:mode!=='runtime-revoked'}:null,discoveryReads=0,providerPosts=0,storedExpiry,releaseDiagnostic,diagnosticResponseFinished=false,diagnosticAbortObserved=false;\n const diagnosticGate=new Promise(resolve=>{releaseDiagnostic=resolve;})",
            "previousText": ";let channel=mode==='activation-unknown'?{id:'own-channel',anchorProjectId:'project-a',revision:2,mode:'PREPARED',displayPhoneNumber:'+54 911 0000 9999',connectionStatus:'PENDING',enabled:false}:runtimeMode||storedMode?{id:'own-channel',anchorProjectId:'project-a',revision:4,mode:mode==='runtime-revoked'?'SUSPENDED':'COMPANY',displayPhoneNumber:'+54 911 0000 9999',connectionStatus:'CONNECTED',enabled:mode!=='runtime-revoked'}:null,discoveryReads=0,providerPosts=0,storedExpiry"
          },
          {
            "currentOffsetCharacters": 13477,
            "currentText": "diagnosticMode?'2099-10-24T12:00:00.000Z':",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 13944,
            "currentText": "diagnosticMode?'2026-10-24T12:00:00.000Z':",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 19039,
            "currentText": "RUNTIME_DIAGNOSTIC'){\n  assert.equal(diagnosticMode,true,'Runtime diagnosis is explicitly exercised by its own scenario');assert.deepEqual(input,{projectId:'project-a',scope,discovery:'OWN_RUNTIME_DIAGNOSTIC'});diagnosticQueries.push({...input});\n  if(mode==='stored-runtime-diagnostic-stale-reference')await diagnosticGate;\n  const rejected=mode==='stored-runtime-diagnostic-rejected';return {version:1,kind:'OWN_COMPANY_RUNTIME_DIAGNOSTIC',readOnly:true,canManage:false,codeVerificationPresent:true,codeVerificationState:'VERIFIED',registered:true,platformState:'CLOUD_API',displayComparable:true,displayMatchesExpected:!rejected,observedAt:diagnosticObservedAt,checkedAt:diagnosticCheckedAt,inspectionState:'CURRENT',operationalCheck:rejected?'REJECTED':'PASSED',denialStage:rejected?'DISPLAY_PHONE_MATCH':'NONE',accepted:false,roundTrip:'NOT_VERIFIED'};\n }if(input.discovery==='OWN_NUMBER'){discoveryReads++;return discovery(input.projectId);}return {...identity,scope,projectId:input.projectId,schemaReady:true,canManage:true,channels:[],projects,capabilities:{attendance:false,kyc:false,media:false,flows:false,templates:false},accepted:false,truncated:false};}}});\n const intercept=async target=>{await target.setRequestInterception(true);target.on('request',async request=>{try{const url=new URL(request.url());if(url.origin!==origin){assert.ok(['data:','blob:'].includes(url.protocol),'No external provider request');return request.continue();}if(!url.pathname.startsWith('/api/'))return request.continue();assert.equal(url.pathname,'/api/identity/company-channel');const headers=new Headers(request.headers());if(request.method()==='POST'){assert.equal(diagnosticMode,false,'A runtime diagnosis must never dispatch a POST');assert.equal(headers.get('origin'),origin);headers.set('origin','https://obrasaas.com');}const canonical=new Request('https://obrasaas.com'+url.pathname+url.search,{method:request.method(),headers,...(request.method()==='POST'?{body:request.postData()}: {})}),response=await handlers[request.method()](canonical);assert.match(response.headers.get('Cache-Control'),/private, no-store/);const body=await response.text();if(mode==='stored-runtime-diagnostic-stale-reference'&&url.searchParams.get('discovery')==='OWN_RUNTIME_DIAGNOSTIC'){\n  assert.equal(request.method(),'GET');assert.equal(diagnosticAbortObserved,true,'Only the correlated browser-aborted diagnostic response may be discarded');assert.equal(request.failure()?.errorText,'net::ERR_ABORTED');assert.equal(response.status,200);assert.equal(JSON.parse(body).operationalCheck,'PASSED');diagnosticResponseFinished=true;return;\n }await request.respond({status:response.status,headers:Object.fromEntries(response.headers),body",
            "previousText": "NUMBER'){discoveryReads++;return discovery(input.projectId);}return {...identity,scope,projectId:input.projectId,schemaReady:true,canManage:true,channels:[],projects,capabilities:{attendance:false,kyc:false,media:false,flows:false,templates:false},accepted:false,truncated:false};}}});\n const intercept=async target=>{await target.setRequestInterception(true);target.on('request',async request=>{try{const url=new URL(request.url());if(url.origin!==origin){assert.ok(['data:','blob:'].includes(url.protocol),'No external provider request');return request.continue();}if(!url.pathname.startsWith('/api/'))return request.continue();assert.equal(url.pathname,'/api/identity/company-channel');const headers=new Headers(request.headers());if(request.method()==='POST'){assert.equal(headers.get('origin'),origin);headers.set('origin','https://obrasaas.com');}const canonical=new Request('https://obrasaas.com'+url.pathname+url.search,{method:request.method(),headers,...(request.method()==='POST'?{body:request.postData()}: {})}),response=await handlers[request.method()](canonical);assert.match(response.headers.get('Cache-Control'),/private, no-store/);await request.respond({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()"
          },
          {
            "currentOffsetCharacters": 26103,
            "currentText": " else if(diagnosticMode){\n    const diagnosticArea=area+' [aria-labelledby=own-company-meta-check-title]',originalChannel=structuredClone(channel);\n    await click(page,'Consultar estado del número');await idle(page);await text(page,'Conexión guardada habilitada');await text(page,'Autorización para configurar no vigente');await text(page,'Prueba de conversación pendiente');assert.equal(diagnosticQueries.length,0,'Stored discovery must not automatically consult Meta');assert.equal(await page.$(diagnosticArea+' time'),null);assert.deepEqual(await references(page),[]);\n    assert.equal(await page.$(area+' form'),null);assert.equal(await page.$$eval(area+' button',buttons=>buttons.some(button=>['Conectar número propio','Activar conexión del número','Confirmar recuperación de conexión'].includes(button.textContent.trim()))),false);assert.equal(posts.length,0);assert.equal(providerPosts,0);\n    if(mode==='stored-runtime-diagnostic-stale-reference')page.on('requestfailed',request=>{const url=new URL(request.url());if(request.method()==='GET'&&url.origin===origin&&url.pathname==='/api/identity/company-channel'&&url.searchParams.get('scope')===scope&&url.searchParams.get('projectId')==='project-a'&&url.searchParams.get('discovery')==='OWN_RUNTIME_DIAGNOSTIC')diagnosticAbortObserved=request.failure()?.errorText==='net::ERR_ABORTED';});\n    await click(page,'Comprobar estado en Meta');\n    if(mode==='stored-runtime-diagnostic-stale-reference'){\n     await text(page,'Consultando el estado en Meta…');assert.equal(diagnosticQueries.length,1);await page.waitForFunction(()=>document.querySelector('[data-context=project]')?.disabled===true,{timeout:20000});assert.equal(await page.$eval('[data-context=project]',button=>button.disabled),true,'Context changes remain blocked while consulting');\n     await page.evaluate(()=>window.__seedLegacy());await text(page,'Hay una decisión pendiente. Comprobala antes de continuar.');await idle(page);const [entry]=await references(page);assert.equal(entry.operationId,legacyOperationId);assert.equal(entry.action,'PREPARE');assert.equal(await page.$(diagnosticArea),null,'Reference invalidation hides the previous snapshot');\n     for(let i=0;i<200&&!diagnosticAbortObserved;i++)await new Promise(resolve=>setTimeout(resolve,50));assert.equal(diagnosticAbortObserved,true,'Reference invalidation must abort the in-flight GET');releaseDiagnostic();\n     for(let i=0;i<200&&!diagnosticResponseFinished;i++)await new Promise(resolve=>setTimeout(resolve,50));assert.equal(diagnosticResponseFinished,true,'The held server result must finish after invalidation');assert.equal(await page.$(diagnosticArea),null);assert.equal(await page.$(area+' time'),null);assert.equal(await page.$eval(area,element=>element.innerText.includes('Consulta completada')),false,'A late success must not restore the invalidated diagnostic');assert.deepEqual(await references(page),[entry]);\n     await click(page,'Cambiar obra','main');await text(page,'project-b');assert.equal(await page.$(diagnosticArea),null);assert.equal(await page.$(area+' dl'),null);assert.equal(discoveryReads,1);\n    }else{\n     await idle(page);await text(page,mode==='stored-runtime-diagnostic-rejected'?'Meta requiere revisión':'Consulta completada');await text(page,'Verificación informada por Meta');await text(page,'Registro informado por Meta');await text(page,'Conexión en la nube');await text(page,mode==='stored-runtime-diagnostic-rejected'?'No se pudo confirmar la coincidencia':'Coincide con el número de la empresa');await text(page,'Este resultado no confirma el envío ni la recepción de mensajes');\n     const observed=await page.$eval(diagnosticArea+' time',element=>({dateTime:element.dateTime,text:element.textContent}));assert.equal(observed.dateTime,diagnosticObservedAt);assert.equal(observed.text,'24/10/2026, 09:34:56 (hora de Argentina)');assert.deepEqual(await references(page),[]);assert.equal(posts.length,0);assert.equal(providerPosts,0);assert.equal(await page.$(area+' form'),null);assert.equal(await page.$$eval(area+' button',buttons=>buttons.some(button=>['Conectar número propio','Activar conexión del número','Confirmar recuperación de conexión'].includes(button.textContent.trim()))),false,'A diagnostic result must not enable configuration');await geometry(page,width);await page.screenshot({path:path.join(output,mode+'-'+width+'-diagnostic.png'),fullPage:true});\n     await click(page,'Consultar estado del número');await idle(page);await text(page,'Conexión guardada habilitada');assert.equal(await page.$(diagnosticArea+' time'),null,'Refreshing the snapshot clears the previous diagnostic');assert.equal(discoveryReads,2);assert.equal(diagnosticQueries.length,1,'Refreshing stored state must not repeat the diagnostic GET');await click(page,'Cerrar consulta');await click(page,'Cambiar obra','main');await text(page,'project-b');assert.equal(await page.$(area+' dl'),null);assert.deepEqual(await references(page),[]);\n    }\n    assert.deepEqual(diagnosticQueries,[{projectId:'project-a',scope,discovery:'OWN_RUNTIME_DIAGNOSTIC'}]);assert.deepEqual(channel,originalChannel,'Read-only diagnosis must not mutate canonical channel state');assert.equal(posts.length,0);assert.equal(providerPosts,0);assert.deepEqual(queries,[]);assert.equal(await page.$(area+' form'),null);assert.equal(await page.$$eval(area+' button',buttons=>buttons.some(button=>['Conectar número propio','Activar conexión del número','Confirmar recuperación de conexión'].includes(button.textContent.trim()))),false);await geometry(page,width);\n   }\n   ",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 38724,
            "currentText": " await page.screenshot({path:path.join(output,mode+'-'+width+'.png'),fullPage:true});checks.push({width,mode,posts:posts.length,discoveryReads,diagnosticQueries,diagnosticAbortObserved,diagnosticResponseFinished",
            "previousText": "await page.screenshot({path:path.join(output,mode+'-'+width+'.png'),fullPage:true});checks.push({width,mode,posts:posts.length,discoveryReads"
          }
        ]
      },
      {
        "path": "scripts/verify-own-company-templates-ui.mjs",
        "status": "MODIFIED",
        "previousSha256": "da57cc50555cb51d94886e72e4eef338d75da0831a8db6cd27cb456a5b075ae3",
        "currentSha256": "d9e6fc3b899ca2dd0fb84378f9240e5ccfcd9b1cec720a7128437a8af0c2c843",
        "previousBytes": 22120,
        "currentBytes": 22162,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 1215,
            "currentText": "own-company-runtime-diagnostic-view.mjs','",
            "previousText": ""
          }
        ]
      },
      {
        "path": "src/app/(identity)/cuenta/own-company-number-panel.js",
        "status": "MODIFIED",
        "previousSha256": "d2146290e43adb77dc14b707787023a24ffe80c39e69eaa49fc876dcab3d267b",
        "currentSha256": "6682c17bdb11ea4269540e3a4f14546e013d72869ba19c79a41312cbc65419bf",
        "previousBytes": 25518,
        "currentBytes": 29203,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 25,
            "currentText": "Callback,use",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 624,
            "currentText": "import {ownCompanyRuntimeDiagnostic,ownCompanyRuntimeDiagnosticContext,ownCompanyRuntimeDiagnosticCurrent,ownCompanyRuntimeDiagnosticAvailable,ownCompanyRuntimeDiagnosticExplain,ownCompanyRuntimeDiagnosticLabels} from './own-company-runtime-diagnostic-view.mjs';\n",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 2769,
            "currentText": "[diagnostic,setDiagnostic]=useState(null),[diagnosticNotice,setDiagnosticNotice]=useState('');\n const alive=useRef(true),epoch=useRef(0),controller=useRef(null),editor=useRef(null),reference=useRef(null),attemptContext=useRef(null),localRequest=useRef(false),refreshReferences=useRef(async()=>{}),diagnosticSnapshot=useRef(null);\n const updateData=useCallback(value=>{diagnosticSnapshot.current=value;setData(value);setDiagnostic(null);setDiagnosticNotice('');},[]",
            "previousText": "alive=useRef(true),epoch=useRef(0),controller=useRef(null),editor=useRef(null),reference=useRef(null),attemptContext=useRef(null),localRequest=useRef(false),refreshReferences=useRef(async()=>{}"
          },
          {
            "currentOffsetCharacters": 4113,
            "currentText": "Diagnostic(null);setDiagnosticNotice('');setNeedsRead(true);if(stored)update",
            "previousText": "NeedsRead(true);if(stored)set"
          },
          {
            "currentOffsetCharacters": 4594,
            "currentText": ",updateData",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 5032,
            "currentText": "update",
            "previousText": "set"
          },
          {
            "currentOffsetCharacters": 6896,
            "currentText": ",updateData",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 7107,
            "currentText": "update",
            "previousText": "set"
          },
          {
            "currentOffsetCharacters": 8221,
            "currentText": "update",
            "previousText": "set"
          },
          {
            "currentOffsetCharacters": 8508,
            "currentText": "update",
            "previousText": "set"
          },
          {
            "currentOffsetCharacters": 8958,
            "currentText": "updateData(null);setReceipt(null);setConnectRecovery(null);setConfirmRecovery(false);setNeedsRead(true);setOpened(false);setNotice(attempt?'La referencia del intento sigue guardada para comprobarla.':'');}\n async function checkMeta(){\n  if(busy||localRequest.current||locked||draft)return;\n  const n=epoch.current+1;let captured;\n  const currentContext=()=>ownCompanyRuntimeDiagnosticContext(diagnosticSnapshot.current,{scope,projectId},{sequence:epoch.current,reference:reference.current});\n  try{captured=ownCompanyRuntimeDiagnosticContext(diagnosticSnapshot.current,{scope,projectId},{sequence:n,reference:reference.current});}catch{setDiagnostic(null);setDiagnosticNotice('Volvé a consultar el número antes de comprobar su estado en Meta.');return;}\n  epoch.current=n;const abort=new AbortController();controller.current?.abort();controller.current=abort;setBusy(true);setDiagnostic(null);setDiagnosticNotice('Consultando el estado en Meta…');\n  const current=()=>{if(!alive.current||epoch.current!==n)return false;try{return ownCompanyRuntimeDiagnosticCurrent(captured,currentContext());}catch{return false;}};\n  let handled=false;\n  try{const observation=await request({discovery:'OWN_RUNTIME_DIAGNOSTIC'},{signal:abort.signal,requestTimeoutMs:45000},ownCompanyRuntimeDiagnostic);if(current()){handled=true;setDiagnostic(observation);setDiagnosticNotice('');}}\n  catch(error){if(current()){handled=true;const message=ownCompanyRuntimeDiagnosticExplain(error);hideDenied(error);setDiagnosticNotice(message);if(ownCompanyNumberAccessDenied(error))setNotice(message);}}\n  finally{if(alive.current&&epoch.current===n){setBusy(false);if(!handled)setDiagnosticNotice('La consulta se descartó porque cambió el contexto. Volvé a consultar el número.');}}\n ",
            "previousText": "setData(null);setReceipt(null);setConnectRecovery(null);setConfirmRecovery(false);setNeedsRead(true);setOpened(false);setNotice(attempt?'La referencia del intento sigue guardada para comprobarla.':'');"
          },
          {
            "currentOffsetCharacters": 11053,
            "currentText": "Diagnostic(null);setDiagnosticNotice('');set",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 13101,
            "currentText": "update",
            "previousText": "set"
          },
          {
            "currentOffsetCharacters": 14388,
            "currentText": "iagnostic(null);setDiagnosticNotice('');setD",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 15110,
            "currentText": "update",
            "previousText": "set"
          },
          {
            "currentOffsetCharacters": 18023,
            "currentText": " const diagnosticAvailable=ownCompanyRuntimeDiagnosticAvailable(data,{scope,projectId}),diagnosticLabels=diagnostic?ownCompanyRuntimeDiagnosticLabels(diagnostic):null;\n",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 25223,
            "currentText": "    {diagnosticAvailable&&<div className={styles.channel} aria-labelledby=\"own-company-meta-check-title\"><div className={styles.channelHeading}><h4 id=\"own-company-meta-check-title\">Comprobación en Meta</h4><button type=\"button\" disabled={busy||locked||Boolean(draft)} onClick={checkMeta}><RefreshCw size={16} aria-hidden=\"true\"/>Comprobar estado en Meta</button></div><p className={styles.note}>Consulta el estado actual. No envía mensajes ni cambia la conexión.</p><p className={diagnosticNotice?styles.notice:styles.silent} role=\"status\" aria-live=\"polite\">{diagnosticNotice}</p>{diagnostic&&<><p className={styles.note}><strong>{diagnosticLabels.summary}</strong> · Observado el <OwnCompanyDateTime value={diagnostic.observedAt}/>.</p><dl className={styles.context}><div><dt>Verificación del número</dt><dd>{diagnosticLabels.verification}</dd></div><div><dt>Registro</dt><dd>{diagnosticLabels.registration}</dd></div><div><dt>Conexión</dt><dd>{diagnosticLabels.platform}</dd></div><div><dt>Número de la empresa</dt><dd>{diagnosticLabels.number}</dd></div></dl><p className={styles.note}>Este resultado no confirma el envío ni la recepción de mensajes. La prueba de conversación se comprueba por separado.</p></>}</div>}\n",
            "previousText": ""
          }
        ]
      },
      {
        "path": "src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs",
        "status": "ADDED",
        "previousSha256": null,
        "currentSha256": "a2b5b4fe2499168ee8afe10cc3aa767f56757b376531ab63e4c557b5ed26ea52",
        "previousBytes": 0,
        "currentBytes": 5756,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 0,
            "currentText": "import {ownCompanyNumberSnapshot} from './own-company-number-view.mjs';\n\nconst shape=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===keys.slice().sort().join('|');\nconst timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;\nconst contextKeys=['scope','projectId','organizationId','actorId','connectionId','channelRevision','credentialExpiresAt','sequence','reference'];\nconst resultKeys=['version','kind','readOnly','canManage','codeVerificationPresent','codeVerificationState','registered','platformState','displayComparable','displayMatchesExpected','observedAt','checkedAt','inspectionState','operationalCheck','denialStage','accepted','roundTrip'];\nconst fail=()=>{throw Object.assign(new Error('No se pudo comprobar el estado actual en Meta.'),{code:'META_OWN_COMPANY_DIAGNOSTIC_UNCONFIRMED'});};\n\n// This DTO is an observation only. It never enters the setup snapshot or any\n// command builder, and cannot enable connection, activation or templates.\nexport function ownCompanyRuntimeDiagnostic(value){\n if(!shape(value,resultKeys)||value.version!==1||value.kind!=='OWN_COMPANY_RUNTIME_DIAGNOSTIC'||value.readOnly!==true||value.canManage!==false||value.accepted!==false||value.roundTrip!=='NOT_VERIFIED'||value.inspectionState!=='CURRENT'||!['PASSED','REJECTED'].includes(value.operationalCheck)||!['NONE','VERIFICATION_STATUS','DISPLAY_PHONE_MATCH'].includes(value.denialStage)||!['VERIFIED','NOT_VERIFIED','EXPIRED','OTHER','MISSING'].includes(value.codeVerificationState)||!['CLOUD_API','NOT_APPLICABLE','OTHER','MISSING'].includes(value.platformState)||['codeVerificationPresent','registered','displayComparable','displayMatchesExpected'].some(key=>typeof value[key]!=='boolean')||!timestamp(value.observedAt)||!timestamp(value.checkedAt)||Date.parse(value.checkedAt)<Date.parse(value.observedAt)||Date.parse(value.checkedAt)-Date.parse(value.observedAt)>=60000)fail();\n if(value.codeVerificationPresent!==(value.codeVerificationState!=='MISSING')||value.registered&&value.platformState!=='CLOUD_API'||value.displayMatchesExpected&&!value.displayComparable)fail();\n if(value.operationalCheck==='PASSED'&&(value.denialStage!=='NONE'||value.codeVerificationState!=='VERIFIED'||!value.registered||value.platformState!=='CLOUD_API'||!value.displayMatchesExpected))fail();\n if(value.operationalCheck==='REJECTED'&&(value.denialStage==='NONE'||value.denialStage==='VERIFICATION_STATUS'&&value.codeVerificationState==='VERIFIED'||value.denialStage==='DISPLAY_PHONE_MATCH'&&(value.codeVerificationState!=='VERIFIED'||value.displayMatchesExpected)))fail();\n return Object.freeze(Object.fromEntries(resultKeys.map(key=>[key,value[key]])));\n}\n\nexport function ownCompanyRuntimeDiagnosticContext(snapshot,expected,{sequence,reference=null,now=Date.now()}={}){\n ownCompanyNumberSnapshot(snapshot,expected);\n const channel=snapshot.channel,grant=snapshot.operationalGrant;\n if(!Number.isSafeInteger(sequence)||sequence<1||!Number.isSafeInteger(now)||snapshot.actor.role!=='ADMIN'||channel?.mode!=='COMPANY'||channel.enabled!==true||channel.connectionStatus!=='CONNECTED'||grant?.version!==2||grant.state!=='ACTIVE'||!timestamp(grant.credentialExpiresAt)||Date.parse(grant.credentialExpiresAt)<=now)fail();\n const referenceKey=reference===null?null:JSON.stringify([reference.version,reference.resource,reference.scope,reference.projectId,reference.operationId,reference.action,reference.connectionId,reference.createdAt]);\n return Object.freeze({scope:expected.scope,projectId:expected.projectId,organizationId:snapshot.organization.id,actorId:snapshot.actor.id,connectionId:channel.id,channelRevision:channel.revision,credentialExpiresAt:grant.credentialExpiresAt,sequence,reference:referenceKey});\n}\n\nexport function ownCompanyRuntimeDiagnosticCurrent(captured,current){\n return Boolean(shape(captured,contextKeys)&&shape(current,contextKeys)&&contextKeys.every(key=>captured[key]===current[key]));\n}\n\nexport function ownCompanyRuntimeDiagnosticAvailable(snapshot,expected,now=Date.now()){\n try{ownCompanyRuntimeDiagnosticContext(snapshot,expected,{sequence:1,now});return true;}catch{return false;}\n}\n\nexport function ownCompanyRuntimeDiagnosticExplain(error){\n if(error?.code==='SESSION_REQUIRED'||error?.status===401)return 'Tu sesión terminó. Volvé a ingresar para consultar.';\n if(error?.name==='AbortError')return 'La comprobación se canceló. Podés volver a consultarla.';\n if(error?.code==='META_OWN_COMPANY_CONFIGURATION_PENDING')return 'La comprobación en Meta no está disponible en este momento.';\n if([401,403].includes(error?.status)||['WORKSPACE_CONTEXT_CHANGED','WORKSPACE_PROJECT_UNAVAILABLE','META_OWN_COMPANY_CONTEXT_CHANGED'].includes(error?.code))return 'No se pudo comprobar el estado con tu acceso actual. Volvé a consultar el número.';\n return 'No se pudo completar la comprobación. Podés volver a consultarla.';\n}\n\nexport function ownCompanyRuntimeDiagnosticLabels(value){\n const diagnostic=ownCompanyRuntimeDiagnostic(value);\n return {verification:diagnostic.codeVerificationState==='VERIFIED'?'Verificación informada por Meta':diagnostic.codeVerificationState==='MISSING'?'Meta no informó la verificación':'Requiere revisión en Meta',registration:diagnostic.registered?'Registro informado por Meta':'Registro por revisar',platform:diagnostic.platformState==='CLOUD_API'?'Conexión en la nube':diagnostic.platformState==='MISSING'?'No informada por Meta':'Conexión por revisar',number:diagnostic.displayMatchesExpected?'Coincide con el número de la empresa':'No se pudo confirmar la coincidencia',summary:diagnostic.operationalCheck==='PASSED'?'Consulta completada':'Meta requiere revisión'};\n}\n",
            "previousText": ""
          }
        ]
      },
      {
        "path": "src/lib/company-channel-http.mjs",
        "status": "MODIFIED",
        "previousSha256": "e0a5ff271543ad3f54deab699aa585213dc504fda92112e179743f2520a737f2",
        "currentSha256": "be95404d1d4fcff3422138b7d92ac960fc5bfdc9bae4b6fcbecf961cb23ca148",
        "previousBytes": 2093,
        "currentBytes": 2118,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 1488,
            "currentText": ",'OWN_RUNTIME_DIAGNOSTIC'",
            "previousText": ""
          }
        ]
      },
      {
        "path": "src/lib/company-channel-store.mjs",
        "status": "MODIFIED",
        "previousSha256": "300c5e7e0abe65b97b86a200c6cc72444b9c65ce375d61975c56f5abbc6a453b",
        "currentSha256": "26686333bb7d5fcddf40b14f25b8c322e16ddef0d62690b2e6d1d1b4a6de2e72",
        "previousBytes": 19173,
        "currentBytes": 19350,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 9412,
            "currentText": "   if(context.discovery==='OWN_RUNTIME_DIAGNOSTIC'){if(!ownConnection)fail('META_OWN_COMPANY_CONFIGURATION_PENDING',503);return ownConnection.diagnoseRuntime(session,context);}\n",
            "previousText": ""
          }
        ]
      },
      {
        "path": "src/lib/meta-customer-provider.mjs",
        "status": "MODIFIED",
        "previousSha256": "102ae45ad7d0a1054d2c65cdbfa3a6a96accfcd982bebce8d6c32c7bf24b21a2",
        "currentSha256": "93c30d36b4a5f3c9b453e907a4ff189dee73879987eb85952cfd2841c26e4594",
        "previousBytes": 56412,
        "currentBytes": 61847,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 1151,
            "currentText": "// Opaque, module-private witnesses. Public DTOs/errors cannot mint these.\nconst ownRuntimeDiagnosticFrames=new WeakMap(),ownRuntimeDiagnosticResults=new WeakMap();\n",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 2009,
            "currentText": "function reportOwnPhoneRejection(stage){try{console.warn(JSON.stringify({event:'META_OWN_COMPANY_PHONE_REJECTED',version:1,stage}));}catch{}}\n",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 4122,
            "currentText": "\nexport function projectOwnCompanyRuntimeDiagnostic(value,{capability,connection,token,environment=process.env,now=Date.now()}={}){\n const proof=ownRuntimeDiagnosticResults.get(value);ownRuntimeDiagnosticResults.delete(value);\n if(!proof||proof.capability!==capability||proof.connection!==connection||proof.tokenDigest!==customerTokenDigest(token||'')||!Number.isSafeInteger(now)||now<proof.checkedAt||now-proof.startedAt>=60000)throw new WorkspaceError('META_OWN_COMPANY_UNAVAILABLE',403);\n const current=ownCompanyTransportPolicy(capability,environment,now),canonical=ownCompanyConnectionPolicy(connection,environment,now);\n if(ownCompanyCapabilityKind(capability)!=='RUNTIME'||current.connectionId!==connection.id||current.grantDigest!==canonical.grantDigest||current.tokenDigest!==proof.tokenDigest)throw new WorkspaceError('META_OWN_COMPANY_UNAVAILABLE',403);\n return proof.projection;\n}\n",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 14436,
            "currentText": ",ownDiagnostic=null",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 25587,
            "currentText": ",diagnostic=null",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 28732,
            "currentText": ",ownDiagnostic:diagnostic});\n }\n\n async function ownConnectionProvider({capability,connection,token,beforeExternal},diagnostic=null){\n  const current=ownCompanyTransportPolicy(capability,environment,now()),canonical=ownCompanyConnectionPolicy(connection,environment,now()),runtime=Object.hasOwn(connection.metadata,'ownCompanyRuntime');\n  if(current.policyDigest!==canonical?.policyDigest||ownCompanyCapabilityKind(capability)!==(runtime?'RUNTIME':'ADMIN')||runtime&&(current.connectionId!==connection.id||current.grantDigest!==canonical.grantDigest||current.tokenDigest!==customerTokenDigest(token||'')))throw new WorkspaceError('META_OWN_COMPANY_UNAVAILABLE',403);\n  if(runtime&&typeof beforeExternal!=='function')throw new WorkspaceError('META_OWN_COMPANY_UNAVAILABLE',403);\n  const scoped=await auditOwnCapability(capability,token,runtime?beforeExternal:null,null,diagnostic),verified=await scoped.inspect({token,wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,numberMode:'DEDICATED'});\n  if(runtime&&(verified.registered!==true||verified.platformType!=='CLOUD_API'||await scoped.inspectSubscription({token,wabaId:connection.whatsappBusinessId})!==true))throw new WorkspaceError('META_OWN_COMPANY_OWNER_UNVERIFIED',403);return scoped;\n }\n function captureOwnRuntimePhone(phone,policy,token,sequence){\n  const frame=ownRuntimeDiagnosticFrames.get(ownDiagnostic);\n  if(!frame||frame.capability!==ownCapability||frame.tokenDigest!==customerTokenDigest(token)||frame.connection.phoneNumberId!==String(phone.id)||frame.connection.whatsappBusinessId!==policy.wabaId)return;\n  let normalized=null;try{normalized=normalizeCompanyPhone(phone.display_phone_number,true);}catch{}\n  const present=Object.hasOwn(phone,'code_verification_status');\n  const verification=present?['VERIFIED','NOT_VERIFIED','EXPIRED'].includes(phone.code_verification_status)?phone.code_verification_status:'OTHER':'MISSING';\n  const platform=phone.platform_type==null?'MISSING':['CLOUD_API','NOT_APPLICABLE'].includes(phone.platform_type)?phone.platform_type:'OTHER';\n  frame.inspection={sequence,current:()=>sequence===inspectionSequence,checkedAt:now(),projection:Object.freeze({codeVerificationPresent:present,codeVerificationState:verification,registered:phone.status==='CONNECTED'&&phone.platform_type==='CLOUD_API',platformState:platform,displayComparable:normalized!==null,displayMatchesExpected:normalized!==null&&normalized===policy.expectedPhoneE164})};\n }\n function rejectOwnPhone(stage,sequence){\n  reportOwnPhoneRejection(stage);const error=new WorkspaceError('META_OWN_COMPANY_PHONE_REJECTED',403),frame=ownRuntimeDiagnosticFrames.get(ownDiagnostic);\n  if(frame?.capability===ownCapability&&frame.inspection?.sequence===sequence)frame.rejection={error,stage,sequence};\n  throw error",
            "previousText": "})"
          },
          {
            "currentOffsetCharacters": 34794,
            "currentText": "phoneCodeVerified!==true||proof.",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 40788,
            "currentText": "  async diagnoseOwnConnection({capability,connection,token,beforeExternal}){\n   if(ownCapability||pilotCapability||ownCompanyCapabilityKind(capability)!=='RUNTIME'||connection?.metadata?.ownCompanyRuntime?.version!==2||typeof beforeExternal!=='function')throw new WorkspaceError('META_OWN_COMPANY_UNAVAILABLE',403);\n   const current=ownCompanyTransportPolicy(capability,environment,now()),canonical=ownCompanyConnectionPolicy(connection,environment,now());\n   if(current.connectionId!==connection.id||current.grantDigest!==canonical.grantDigest||current.tokenDigest!==customerTokenDigest(token||''))throw new WorkspaceError('META_OWN_COMPANY_UNAVAILABLE',403);\n   const handle=Object.freeze({}),frame={capability,connection,tokenDigest:customerTokenDigest(token),startedAt:now(),inspection:null,rejection:null};\n   ownRuntimeDiagnosticFrames.set(handle,frame);\n   try{\n    let failure;try{await ownConnectionProvider({capability,connection,token,beforeExternal},handle);}catch(error){failure=error;}\n    await beforeExternal();ownCompanyTransportPolicy(capability,environment,now());\n    const observation=frame.inspection;\n    // Only this inspection's internally created error is an observation.\n    // A provider/adapter error with matching code/stage is never a witness.\n    if(!observation||!observation.current()||failure&&(frame.rejection?.error!==failure||frame.rejection.sequence!==observation.sequence))throw failure||new WorkspaceError('META_OWN_COMPANY_UNAVAILABLE',403);\n    if(now()<observation.checkedAt||now()-frame.startedAt>=60000)throw new WorkspaceError('META_OWN_COMPANY_UNAVAILABLE',403);\n    const projection=Object.freeze({version:1,kind:'OWN_COMPANY_RUNTIME_DIAGNOSTIC',readOnly:true,canManage:false,...observation.projection,observedAt:new Date(observation.checkedAt).toISOString(),checkedAt:new Date(now()).toISOString(),inspectionState:'CURRENT',operationalCheck:failure?'REJECTED':'PASSED',denialStage:failure?frame.rejection.stage:'NONE',accepted:false,roundTrip:'NOT_VERIFIED'});\n    const result=Object.freeze({});ownRuntimeDiagnosticResults.set(result,{capability,connection,tokenDigest:frame.tokenDigest,startedAt:frame.startedAt,checkedAt:now(),projection});return result;\n   }finally{ownRuntimeDiagnosticFrames.delete(handle);}\n  },\n",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 43251,
            "currentText": "return ownConnectionProvider({capability,connection,token,beforeExternal})",
            "previousText": "const current=ownCompanyTransportPolicy(capability,environment,now()),canonical=ownCompanyConnectionPolicy(connection,environment,now()),runtime=Object.hasOwn(connection.metadata,'ownCompanyRuntime');\n     if(current.policyDigest!==canonical?.policyDigest||ownCompanyCapabilityKind(capability)!==(runtime?'RUNTIME':'ADMIN')||runtime&&(current.connectionId!==connection.id||current.grantDigest!==canonical.grantDigest||current.tokenDigest!==customerTokenDigest(token||'')))throw new WorkspaceError('META_OWN_COMPANY_UNAVAILABLE',403);\n     if(runtime&&typeof beforeExternal!=='function')throw new WorkspaceError('META_OWN_COMPANY_UNAVAILABLE',403);\n     const scoped=await auditOwnCapability(capability,token,runtime?beforeExternal:null),verified=await scoped.inspect({token,wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,numberMode:'DEDICATED'});\n     if(runtime&&(verified.registered!==true||verified.platformType!=='CLOUD_API'||await scoped.inspectSubscription({token,wabaId:connection.whatsappBusinessId})!==true))throw new WorkspaceError('META_OWN_COMPANY_OWNER_UNVERIFIED',403);return scoped"
          },
          {
            "currentOffsetCharacters": 49111,
            "currentText": "Policy)captureOwnRuntimePhone(phone,ownPolicy,token,sequence);\n   if(ownCompanyCapabilityKind(ownCapability)==='RUNTIME'&&phone.code_verification_status!=='VERIFIED'){rejectOwnPhone('VERIFICATION_STATUS',sequence);}",
            "previousText": "CompanyCapabilityKind(ownCapability)==='RUNTIME'&&phone.code_verification_status!=='VERIFIED')throw new WorkspaceError('META_OWN_COMPANY_PHONE_REJECTED',403);"
          },
          {
            "currentOffsetCharacters": 51058,
            "currentText": "){rejectOwnPhone('INSPECTION_SUPERSEDED',sequence);}if(normalizeCompanyPhone(verified.displayPhoneNumber,true)!==ownPolicy.expectedPhoneE164){rejectOwnPhone('DISPLAY_PHONE_MATCH',sequence);}inspectedAssets=Object.freeze({capability:ownCapability,wabaId,phoneNumberId,inspectionPhase,registered:verified.registered,platformType:verified.platformType,phoneCodeVerified:phone.code_verification_status==='VERIFIED'",
            "previousText": "||normalizeCompanyPhone(verified.displayPhoneNumber,true)!==ownPolicy.expectedPhoneE164)throw new WorkspaceError('META_OWN_COMPANY_PHONE_REJECTED',403);inspectedAssets=Object.freeze({capability:ownCapability,wabaId,phoneNumberId,inspectionPhase,registered:verified.registered,platformType:verified.platformType"
          }
        ]
      },
      {
        "path": "src/lib/meta-own-company-connection.mjs",
        "status": "MODIFIED",
        "previousSha256": "5bdf8a2c6b1333efe0a12481174e433cd58c9e1583ae0972f4cb090892eaaf84",
        "currentSha256": "33ac37426beb73a142804bc6e6c903d0d18527282dfb590bf685b74e20df2bf5",
        "previousBytes": 34288,
        "currentBytes": 38337,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 314,
            "currentText": ",fenceOwnCompanyRuntime,ownCompanyCapabilityKind,ownCompanyTransportPolicy",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 828,
            "currentText": ",projectOwnCompanyRuntimeDiagnostic",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 9247,
            "currentText": "\n // A diagnostic may acquire canonical SHARE locks, but never writes a receipt,\n // channel, grant or marker. READ COMMITTED is intentional: READ ONLY cannot\n // acquire these locks, and REPEATABLE READ would hide revocation after await.\n async function runtimeDiagnosticSnapshot(session,context,expected=null){return within(session,context,true,async(client,member,scope)=>{\n  await requireCompanyChannelSchema(client);\n  const time=(await client.query('SELECT clock_timestamp() AS now')).rows[0]?.now?.getTime();\n  if(!Number.isSafeInteger(time)||!Number.isSafeInteger(session.expiresAt)||session.expiresAt*1000<=time||member.role!=='ADMIN')fail('META_OWN_COMPANY_UNAVAILABLE',403);\n  const rows=(await client.query(`SELECT c.*,cc.revision,cc.mode FROM public.\"WhatsAppConnection\" c JOIN public.\"WhatsAppCompanyChannel\" cc ON cc.\"connectionId\"=c.id AND cc.\"organizationId\"=$2 AND cc.\"anchorProjectId\"=c.\"projectId\" WHERE c.\"projectId\"=$1`,[context.projectId,member.organizationId])).rows;\n  if(rows.length!==1)fail('META_OWN_COMPANY_UNAVAILABLE',403);\n  const connection=rows[0];\n  if(connection?.metadata?.ownCompanyRuntime?.version!==2||connection.mode!=='COMPANY')fail('META_OWN_COMPANY_UNAVAILABLE',403);\n  const policy=ownCompanyConnectionPolicy(connection,environment,time);\n  if(policy.actorId!==member.actorId||policy.organizationId!==member.organizationId||policy.projectId!==context.projectId||policy.clerkUserId!==session.userId||policy.clerkOrganizationId!==session.organizationId)fail('META_OWN_COMPANY_UNAVAILABLE',403);\n  const capability=await fenceOwnCompanyRuntime(client,connection,{environment,now:time});\n  if(ownCompanyCapabilityKind(capability)!=='RUNTIME')fail('META_OWN_COMPANY_UNAVAILABLE',403);\n  // Preserve issuer/project/connection lock order before the owner-channel lock.\n  const owners=(await client.query(`SELECT revision,mode FROM public.\"WhatsAppCompanyChannel\" WHERE \"connectionId\"=$1 AND \"organizationId\"=$2 AND \"anchorProjectId\"=$3 FOR SHARE`,[connection.id,member.organizationId,context.projectId])).rows;\n  if(owners.length!==1||owners[0].revision!==connection.revision||owners[0].mode!==connection.mode)fail('META_OWN_COMPANY_UNAVAILABLE',403);\n  if(expected){\n   ownCompanyTransportPolicy(expected.capability,environment,time);\n   if(scope!==expected.scope||connection.id!==expected.connection.id||connection.projectId!==expected.connection.projectId||connection.mode!==expected.connection.mode||connection.revision!==expected.connection.revision||connection.encryptedAccessToken!==expected.connection.encryptedAccessToken||policy.grantDigest!==expected.policy.grantDigest)fail('META_OWN_COMPANY_UNAVAILABLE',403);\n  }\n  return {connection,capability,policy,scope,time};\n });}\n",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 21340,
            "currentText": "  async diagnoseRuntime(session,context){\n   const captured=await runtimeDiagnosticSnapshot(session,context);\n   const token=decryptCustomerSecret(captured.connection.encryptedAccessToken,{organizationId:captured.policy.organizationId,projectId:context.projectId,purpose:'access-token',resourceId:captured.connection.phoneNumberId},environment);\n   const beforeExternal=()=>runtimeDiagnosticSnapshot(session,context,captured);\n   let observation,providerFailure;\n   try{observation=await provider.diagnoseOwnConnection({capability:captured.capability,connection:captured.connection,token,beforeExternal});}catch(error){providerFailure=error;}\n   // Authority loss after the last GET dominates even a provider failure or a\n   // hostile adapter's fake observation. No partial result crosses this fence.\n   const final=await beforeExternal();\n   if(providerFailure)throw providerFailure;\n   const completedAt=Math.max(final.time,now());\n   if(!Number.isSafeInteger(completedAt)||session.expiresAt*1000<=completedAt)fail('META_OWN_COMPANY_UNAVAILABLE',403);\n   return projectOwnCompanyRuntimeDiagnostic(observation,{capability:captured.capability,connection:captured.connection,token,environment,now:completedAt});\n  },\n",
            "previousText": ""
          }
        ]
      },
      {
        "path": "tests/fixtures/own-runtime-diagnostic.mjs",
        "status": "ADDED",
        "previousSha256": null,
        "currentSha256": "00b02725ee130032a5ffe0f19c6d29e32bcbdd54285f8d42eeb3a75e876c815b",
        "previousBytes": 0,
        "currentBytes": 4974,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 0,
            "currentText": "import assert from 'node:assert/strict';\nimport {ownCompanyRuntimeFixture} from './own-company-runtime.mjs';\nimport {createOwnCompanyConnection} from '../../src/lib/meta-own-company-connection.mjs';\nimport {COMPANY_CHANNEL_SCHEMA_CONTRACT} from '../../src/lib/company-channel-schema.mjs';\nimport {digest,WorkspaceError} from '../../src/lib/workspace-policy.mjs';\n\n// Proposed fixture only. These imports resolve after the proposal is applied to\n// a reviewed checkout. It is not executable as this incomplete private mirror.\nexport async function ownRuntimeDiagnosticFixture(){\n const f=await ownCompanyRuntimeFixture();\n f.time=Date.parse(f.policy.expiresAt)+1;\n f.member=structuredClone(f.context.member);f.session={...f.context.session,expiresAt:Math.floor(f.time/1000)+300};\n f.request={projectId:f.policy.projectId,scope:'a'.repeat(64)};\n f.channelState={mode:'COMPANY',revision:2};f.schemaReady=true;f.projectPresent=true;f.channelPresent=true;\n f.operations=[];f.reads=[];f.afterQuery=null;\n const rows=value=>({rows:value});\n const client={async query(sql,args=[]){\n  f.reads.push({sql,args});assert.match(sql.trim(),/^SELECT\\b/i,'diagnostic cannot write');assert.doesNotMatch(sql,/\\bFOR\\s+UPDATE\\b/i);\n  let result;\n  if(sql==='SELECT clock_timestamp() AS now')result=rows([{now:new Date(f.time)}]);\n  else if(sql.includes('JOIN public.\"WhatsAppCompanyChannel\" cc'))result=rows(f.channelPresent?[{...structuredClone(f.connection),...f.channelState}]:[]);\n  else if(sql.startsWith('SELECT revision,mode FROM public.\"WhatsAppCompanyChannel\"')){\n   assert.deepEqual(args,[f.connection.id,f.member.organizationId,f.request.projectId]);result=rows(f.channelPresent?[{...f.channelState}]:[]);\n  }\n  else if(sql.includes('to_regclass'))result=rows([{present:f.schemaReady,count:1}]);\n  else if(sql.startsWith('SELECT\\n  (SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('))result=rows([{columns:[],keys:[],indexes:[],triggers:[]}]);\n  else if(sql.startsWith('SELECT version,contract,\"catalogFingerprint\",'))result=rows([{version:1,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT,catalogFingerprint:digest({columns:[],keys:[],indexes:[],triggers:[]}),currentCatalog:{columns:[],keys:[],indexes:[],triggers:[]},catalog:args[1].map(conname=>({conname,convalidated:true})),indexes:args[2].map(relname=>({relname,indisvalid:true,indisready:true,indisunique:true})),triggers:args[3].map(tgname=>({tgname,tgenabled:'O'}))}]);\n  else if(sql.includes('information_schema.columns'))result=rows(sql.includes(\"column_name='catalogFingerprint'\")?[{count:1}]:[]);\n  else if(sql.includes('FROM public.\"WhatsAppCompanySchema\"'))result=rows([{version:1,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT,catalogFingerprint:digest({columns:[],keys:[],indexes:[],triggers:[]})}]);\n  else if(sql.includes('FROM pg_constraint WHERE'))result=rows(args[0].map(conname=>({conname,convalidated:true})));\n  else if(sql.includes('FROM pg_index i JOIN pg_class c')&&!sql.includes('pg_get_indexdef'))result=rows(args[0].map(relname=>({relname,indisvalid:true,indisready:true,indisunique:true})));\n  else if(sql.includes('FROM pg_trigger WHERE'))result=rows(args[0].map(tgname=>({tgname,tgenabled:'O'})));\n  else if(sql.includes('pg_get_constraintdef')||sql.includes('pg_get_indexdef')||sql.includes('pg_get_triggerdef'))result=rows([]);\n  else result=await f.client.query(sql,args);\n  if(f.afterQuery)await f.afterQuery(sql,args);return result;\n }};\n const workspace={async organizationOperation(session,context,writable,callback,archived=false){\n  f.operations.push({writable,archived});\n  // This models the existing READ COMMITTED transaction with SHARE locks.\n  // Writable transaction mode is not permission for any diagnostic SQL write.\n  assert.equal(writable,true);assert.equal(archived,false);\n  if(context.scope!=='a'.repeat(64))throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',409);\n  if(!f.projectPresent||context.projectId!==f.policy.projectId)throw new WorkspaceError('WORKSPACE_PROJECT_UNAVAILABLE',404);\n  if(f.member.role!=='ADMIN'||f.member.officeReviewOnly===true)throw new WorkspaceError('WORKSPACE_ORGANIZATION_PERMISSION_REQUIRED',403);\n  return callback(client,f.member,f.request.scope);\n }};\n f.makeService=(provider=f.provider)=>createOwnCompanyConnection({workspace,provider,environment:f.environment,now:()=>f.time});\n f.service=f.makeService();f.diagnose=()=>f.service.diagnoseRuntime(f.session,f.request);\n f.runtimeInput=async()=>({capability:await f.capability(),connection:f.connection,token:f.token,beforeExternal:()=>f.beforeExternal(f.connection)});\n f.calls.length=0;f.queries.length=0;\n return f;\n}\n\nexport function assertDiagnosticNoEffects(f){\n assert.ok(f.calls.every(call=>call.method==='GET'));\n assert.equal(f.calls.filter(call=>call.method==='POST').length,0);\n assert.ok(f.reads.every(({sql})=>/^SELECT\\b/i.test(sql.trim())));\n assert.ok(f.queries.every(({sql})=>/^SELECT\\b/i.test(sql.trim())));\n assert.ok(f.operations.every(op=>op.writable===true&&op.archived===false));\n}\n",
            "previousText": ""
          }
        ]
      },
      {
        "path": "tests/production-dependencies.test.mjs",
        "status": "MODIFIED",
        "previousSha256": "88f2446dcd8a36eb653c38dbe114ea449dbac923649b885eb075b530b19bf1bd",
        "currentSha256": "9759c4a5422a97ea3b8ec4ceb6623078f1847d946673c5698370112be18e5282",
        "previousBytes": 2342,
        "currentBytes": 2342,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 880,
            "currentText": "4.3",
            "previousText": "3.6"
          },
          {
            "currentOffsetCharacters": 1523,
            "currentText": "9', 'dompurify': '3.4.17', 'undici': '6.29",
            "previousText": "8', 'dompurify': '3.4.16', 'undici': '6.28"
          }
        ]
      },
      {
        "path": "tests/production-material-review-current-ci-lineage.test.mjs",
        "status": "MODIFIED",
        "previousSha256": "cd3f36d1a26c2b2c82a27537566b9221245a6747012bf9e641fc8c0d73ea565e",
        "currentSha256": "963a93d2c86b15837b8e97fe45dcf55de3db114e6b17438b951b628484d1ac22",
        "previousBytes": 16943,
        "currentBytes": 17542,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 15,
            "currentText": "OwnRuntimeDiagnosticPreviousContract,planBudgetCurrentSourcePin,restore",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 2035,
            "currentText": "actual=current(),actualBefore=serialize(actual),contract=restoreOwnRuntimeDiagnosticPreviousContract(actual,read",
            "previousText": "contract=current("
          },
          {
            "currentOffsetCharacters": 2539,
            "currentText": "actual),actualBefore);assert.equal(serialize(",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 3829,
            "currentText": "focusedProducer(actual).producerSha256,planBudgetCurrentSourcePin(actual,{path:'scripts/verify-focused-workspace-ci.mjs',sha256:focusedProducer(contract).producerSha256}));assert.equal(sha(read('scripts/verify-focused-workspace-ci.mjs').toString('utf8').replaceAll('\\r\\n','\\n')),focusedProducer(actual",
            "previousText": "sha(read('scripts/verify-focused-workspace-ci.mjs').toString('utf8').replaceAll('\\r\\n','\\n')),focusedProducer(contract"
          },
          {
            "currentOffsetCharacters": 4556,
            "currentText": "actual.extension.proofs.find(row=>row.id==='participant-kyc-preanalysis-postgres'),ownBaseProof=contract.extension.proofs.find(row=>row.id===actualProof.id);assert.deepEqual(currentProducerSourceFiles(actualProof,process.cwd()),actualProof.sourceFiles);assert.deepEqual(actualProof.sourceFiles,[...ownBaseProof.sourceFiles,'src/app/(identity)/cuenta/kyc-camera-session.mjs'].sort());const proof={...ownBaseProof,sourceFiles:restorePlanBudgetSourceSet(contract,ownBaseProof.kind,ownBase",
            "previousText": "contract.extension.proofs.find(row=>row.id==='participant-kyc-preanalysis-postgres');assert.deepEqual(currentProducerSourceFiles(actualProof,process.cwd()),actualProof.sourceFiles);const proof={...actualProof,sourceFiles:restorePlanBudgetSourceSet(contract,actualProof.kind,actual"
          }
        ]
      },
      {
        "path": "tests/production-meta-existing-api-plan-current-ci-lineage.test.mjs",
        "status": "MODIFIED",
        "previousSha256": "00d21d855c36f8020bd1791ed3b48b90901f7e017c0611d2df33a3a13ab1978d",
        "currentSha256": "6093e541263392ee458048781d3b407ccbae2ad0e0a1e74a3e58dc85a6c621a9",
        "previousBytes": 11968,
        "currentBytes": 12362,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 15,
            "currentText": "OwnRuntimeDiagnosticPreviousContract,planBudgetCurrentSourcePin,restore",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 3294,
            "currentText": "actual=current(),actualBefore=serialize(actual),contract=restoreOwnRuntimeDiagnosticPreviousContract(actual,read),before=serialize(contract),publishedHomePredecessor=restoreHomeDecisionsPreviousContract(contract),previous=restoreExistingApiPlanPreviousContract(contract);\n assert.equal(sha(serialize(previous)),expected.previousContractSha256);assert.equal(expected.predecessorCommit,'5d0c4303cbced786f2ec8a0a10edaa72b3aff02d');assert.equal(Object.hasOwn(previous,key),false);assert.equal(serialize(actual),actualBefor",
            "previousText": "contract=current(),before=serialize(contract),publishedHomePredecessor=restoreHomeDecisionsPreviousContract(contract),previous=restoreExistingApiPlanPreviousContract(contract);\n assert.equal(sha(serialize(previous)),expected.previousContractSha256);assert.equal(expected.predecessorCommit,'5d0c4303cbced786f2ec8a0a10edaa72b3aff02d');assert.equal(Object.hasOwn(previous,key),fals"
          },
          {
            "currentOffsetCharacters": 4974,
            "currentText": "focusedProducer(actual).producerSha256,planBudgetCurrentSourcePin(actual,{path:'scripts/verify-focused-workspace-ci.mjs',sha256:focusedProducer(contract).producerSha256}));assert.equal(sha(read('scripts/verify-focused-workspace-ci.mjs').toString('utf8').replaceAll('\\r\\n','\\n')),focusedProducer(actual",
            "previousText": "sha(read('scripts/verify-focused-workspace-ci.mjs').toString('utf8').replaceAll('\\r\\n','\\n')),focusedProducer(contract"
          }
        ]
      },
      {
        "path": "tests/production-own-company-runtime-diagnostic-view.test.mjs",
        "status": "ADDED",
        "previousSha256": null,
        "currentSha256": "b349d9d861f97af748dedd7f32963f29a83ca2b152f4a8cbe1a6157379f86bb7",
        "previousBytes": 0,
        "currentBytes": 8837,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 0,
            "currentText": "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {ownCompanyRuntimeDiagnostic,ownCompanyRuntimeDiagnosticContext,ownCompanyRuntimeDiagnosticCurrent,ownCompanyRuntimeDiagnosticAvailable,ownCompanyRuntimeDiagnosticExplain,ownCompanyRuntimeDiagnosticLabels} from '../src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs';\nimport {ownCompanyNumberCanAct,ownCompanyNumberCommand} from '../src/app/(identity)/cuenta/own-company-number-view.mjs';\nimport {createWorkspaceRequestLifecycle} from '../src/app/(identity)/cuenta/workspace-request-lifecycle.mjs';\n\nconst time=Date.parse('2026-10-24T12:00:00.000Z'),scope='a'.repeat(64),expected={scope,projectId:'project-a',organizationId:'org_Test',actorId:'user_AdminA'};\nconst snapshot=()=>({version:1,kind:'OWN_COMPANY_STORED_RUNTIME',organization:{id:expected.organizationId,name:'Empresa sintética'},actor:{id:expected.actorId,role:'ADMIN'},scope,projectId:expected.projectId,readOnly:true,canManage:false,mode:'OWN_COMPANY',evidenceOrigin:'STORED_CANONICAL_RUNTIME',observedAt:new Date(time).toISOString(),configurationAuthorization:{state:'NOT_CURRENT'},channel:{id:'own-channel',anchorProjectId:expected.projectId,revision:4,mode:'COMPANY',displayPhoneNumber:'+5491100009999',connectionStatus:'CONNECTED',enabled:true},operationalGrant:{version:2,state:'ACTIVE',credentialExpiresAt:new Date(time+3600000).toISOString(),roundTrip:'NOT_VERIFIED',fieldJourney:'NOT_VERIFIED'},accepted:false,roundTrip:'NOT_VERIFIED'});\nconst result=()=>({version:1,kind:'OWN_COMPANY_RUNTIME_DIAGNOSTIC',readOnly:true,canManage:false,codeVerificationPresent:true,codeVerificationState:'VERIFIED',registered:true,platformState:'CLOUD_API',displayComparable:true,displayMatchesExpected:true,observedAt:new Date(time).toISOString(),checkedAt:new Date(time+1000).toISOString(),inspectionState:'CURRENT',operationalCheck:'PASSED',denialStage:'NONE',accepted:false,roundTrip:'NOT_VERIFIED'});\nconst context=(patch={})=>ownCompanyRuntimeDiagnosticContext(snapshot(),expected,{sequence:1,now:time,...patch});\n\ntest('client accepts a closed diagnostic observation without granting any setup action',()=>{\n const value=result(),projection=ownCompanyRuntimeDiagnostic(value);assert.deepEqual(projection,value);assert.notEqual(projection,value);assert.equal(Object.isFrozen(projection),true);\n for(const action of ['CONNECT_OWN_NUMBER','ACTIVATE_OWN_NUMBER']){assert.equal(ownCompanyNumberCanAct(projection,action,time),false);assert.throws(()=>ownCompanyNumberCommand(projection,{action},expected,{now:time}));}\n assert.equal(snapshot().canManage,false);assert.equal(ownCompanyRuntimeDiagnosticAvailable(snapshot(),expected,time),true);\n});\n\nfor(const state of ['NOT_VERIFIED','EXPIRED','OTHER','MISSING'])test('client preserves '+state+' as an observed rejected state without implying credential expiry or activation',()=>{\n const value={...result(),codeVerificationPresent:state!=='MISSING',codeVerificationState:state,operationalCheck:'REJECTED',denialStage:'VERIFICATION_STATUS'};\n const projection=ownCompanyRuntimeDiagnostic(value),labels=ownCompanyRuntimeDiagnosticLabels(projection);\n assert.equal(projection.codeVerificationState,state);assert.equal(projection.registered,true);assert.equal(labels.summary,'Meta requiere revisión');assert.doesNotMatch(JSON.stringify(labels),/credencial vencida|autorizado|activado|token|EXPIRED/);\n assert.equal(ownCompanyNumberCanAct(projection,'ACTIVATE_OWN_NUMBER',time),false);\n});\n\ntest('client permits an observed display mismatch while keeping the actual display absent',()=>{\n const projection=ownCompanyRuntimeDiagnostic({...result(),displayMatchesExpected:false,operationalCheck:'REJECTED',denialStage:'DISPLAY_PHONE_MATCH'});\n assert.equal(ownCompanyRuntimeDiagnosticLabels(projection).number,'No se pudo confirmar la coincidencia');assert.equal(Object.hasOwn(projection,'displayPhoneNumber'),false);\n});\n\ntest('client rejects unknown, private, writable, accepted or internally contradictory diagnostic fields',()=>{\n for(const patch of [{token:'private'},{displayPhoneNumber:'+5491100000001'},{phoneNumberId:'220000001'},{rawError:{stage:'VERIFICATION_STATUS'}},{grantDigest:'b'.repeat(64)},{canManage:true},{readOnly:false},{accepted:true},{roundTrip:'VERIFIED'},{inspectionState:'STALE'},{denialStage:'INSPECTION_SUPERSEDED'},{codeVerificationState:'NEW_PROVIDER_VALUE'},{platformState:'NEW_PLATFORM'},{registered:'true'},{codeVerificationPresent:false},{displayComparable:false},{platformState:'MISSING'},{operationalCheck:'REJECTED'},{denialStage:'VERIFICATION_STATUS'}])assert.throws(()=>ownCompanyRuntimeDiagnostic({...result(),...patch}),{code:'META_OWN_COMPANY_DIAGNOSTIC_UNCONFIRMED'});\n assert.throws(()=>ownCompanyRuntimeDiagnostic({...result(),codeVerificationPresent:false,codeVerificationState:'MISSING',operationalCheck:'REJECTED',denialStage:'DISPLAY_PHONE_MATCH',displayMatchesExpected:false}));\n});\n\ntest('diagnostic observation dates are canonical, ordered and bounded independently of device timezone',()=>{\n for(const patch of [{observedAt:'2026-10-24T12:00:00Z'},{checkedAt:'never'},{checkedAt:new Date(time-1).toISOString()},{checkedAt:new Date(time+60000).toISOString()}])assert.throws(()=>ownCompanyRuntimeDiagnostic({...result(),...patch}));\n assert.equal(ownCompanyRuntimeDiagnostic(result()).observedAt,new Date(time).toISOString());\n});\n\ntest('read context requires the current administrator, exact scope/project and active company grant',()=>{\n for(const patch of [{actor:{id:expected.actorId,role:'DIRECTOR'}},{scope:'b'.repeat(64)},{projectId:'project-b'},{channel:{...snapshot().channel,mode:'SUSPENDED'}},{channel:{...snapshot().channel,enabled:false}},{operationalGrant:{...snapshot().operationalGrant,state:'REVOKED'}}])assert.equal(ownCompanyRuntimeDiagnosticAvailable({...snapshot(),...patch},expected,time),false);\n assert.equal(ownCompanyRuntimeDiagnosticAvailable(snapshot(),expected,time+3600000),false);\n assert.throws(()=>ownCompanyRuntimeDiagnosticContext(snapshot(),expected,{sequence:0,now:time}));\n});\n\ntest('late diagnostic response is rejected after actor, organization, worksite, channel, reference or sequence changes',()=>{\n const captured=context();assert.equal(ownCompanyRuntimeDiagnosticCurrent(captured,context()),true);\n for(const patch of [{scope:'b'.repeat(64)},{projectId:'project-b'},{organizationId:'org_Other'},{actorId:'user_Other'},{connectionId:'other-channel'},{channelRevision:5},{credentialExpiresAt:new Date(time+7200000).toISOString()},{sequence:2},{reference:'a-new-reference'}])assert.equal(ownCompanyRuntimeDiagnosticCurrent(captured,{...captured,...patch}),false);\n assert.equal(ownCompanyRuntimeDiagnosticCurrent(captured,null),false);\n const reference={version:1,resource:'company-channel',scope,projectId:expected.projectId,operationId:'11111111-1111-4111-8111-111111111111',action:'ACTIVATE_OWN_NUMBER',connectionId:'own-channel',createdAt:time};\n assert.equal(ownCompanyRuntimeDiagnosticCurrent(context({reference}),context({reference:{...reference,createdAt:time+1}})),false);\n});\n\ntest('actual Clerk transport performs one explicit GET and a late body cannot cross the captured context',async()=>{\n let release,dispatched;const started=new Promise(resolve=>{dispatched=resolve;});\n const captured=context(),url='/api/identity/company-channel?'+new URLSearchParams({scope,projectId:expected.projectId,discovery:'OWN_RUNTIME_DIAGNOSTIC'}),calls=[];\n const lifecycle=createWorkspaceRequestLifecycle(async()=>'synthetic-current-clerk-token',{fetchImpl:async(request,options)=>{\n  calls.push({request,method:options.method,authorization:options.headers.get('Authorization'),cache:options.cache});dispatched();\n  await new Promise(resolve=>{release=resolve;});return Response.json(result());\n }});\n let current=context();const pending=lifecycle.request(url,{method:'GET',requestTimeoutMs:1000},async response=>ownCompanyRuntimeDiagnostic(await response.json())).then(value=>ownCompanyRuntimeDiagnosticCurrent(captured,current)?value:null);\n await started;current={...current,actorId:'user_Other',sequence:2};release();assert.equal(await pending,null);\n assert.deepEqual(calls,[{request:url,method:'GET',authorization:'Bearer synthetic-current-clerk-token',cache:'no-store'}]);lifecycle.abort();\n});\n\ntest('diagnostic errors use fixed actionable copy and never interpolate raw errors or stage labels',()=>{\n for(const error of [{code:'private-token-and-provider-payload'},{message:'private',stage:'VERIFICATION_STATUS'},{code:'META_OWN_COMPANY_UNAVAILABLE',status:403},{code:'META_OWN_COMPANY_CONFIGURATION_PENDING'},{name:'AbortError'}])assert.doesNotMatch(ownCompanyRuntimeDiagnosticExplain(error),/private|VERIFICATION_STATUS|token|autorización de configuración/);\n assert.match(ownCompanyRuntimeDiagnosticExplain({status:401}),/sesión/);\n});\n",
            "previousText": ""
          }
        ]
      },
      {
        "path": "tests/production-own-company-runtime-diagnostic.test.mjs",
        "status": "ADDED",
        "previousSha256": null,
        "currentSha256": "332be4374b0d82752ee13f307af2b39b767d009a8b670b7fa5cdd0d93fd511bc",
        "previousBytes": 0,
        "currentBytes": 12965,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 0,
            "currentText": "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {ownRuntimeDiagnosticFixture,assertDiagnosticNoEffects} from './fixtures/own-runtime-diagnostic.mjs';\nimport {projectOwnCompanyRuntimeDiagnostic} from '../src/lib/meta-customer-provider.mjs';\nimport {ownCompanyCapabilityKind,ownCompanyTransportPolicy} from '../src/lib/meta-own-company-policy.mjs';\nimport {createCompanyChannelHandlers} from '../src/lib/company-channel-http.mjs';\nimport {createCompanyChannelStore} from '../src/lib/company-channel-store.mjs';\nimport {WorkspaceError} from '../src/lib/workspace-policy.mjs';\n\n// Additive coverage; existing operational tests and assertions remain unchanged.\nconst keys=['version','kind','readOnly','canManage','codeVerificationPresent','codeVerificationState','registered','platformState','displayComparable','displayMatchesExpected','observedAt','checkedAt','inspectionState','operationalCheck','denialStage','accepted','roundTrip'].sort();\nfunction assertClosed(result,f){\n assert.deepEqual(Object.keys(result).sort(),keys);\n assert.equal(result.kind,'OWN_COMPANY_RUNTIME_DIAGNOSTIC');assert.equal(result.readOnly,true);assert.equal(result.canManage,false);assert.equal(result.accepted,false);assert.equal(result.roundTrip,'NOT_VERIFIED');\n for(const key of ['codeVerificationPresent','registered','displayComparable','displayMatchesExpected'])assert.equal(typeof result[key],'boolean');\n assert.ok(['VERIFIED','NOT_VERIFIED','EXPIRED','OTHER','MISSING'].includes(result.codeVerificationState));assert.ok(['CLOUD_API','NOT_APPLICABLE','OTHER','MISSING'].includes(result.platformState));\n assert.ok(['PASSED','REJECTED'].includes(result.operationalCheck));assert.ok(['NONE','VERIFICATION_STATUS','DISPLAY_PHONE_MATCH'].includes(result.denialStage));assert.equal(result.inspectionState,'CURRENT');\n for(const key of ['observedAt','checkedAt'])assert.equal(new Date(result[key]).toISOString(),result[key]);\n assert.ok(Object.values(result).every(value=>typeof value!=='function'&&typeof value!=='object'));\n const encoded=JSON.stringify(result);\n for(const privateValue of [f.token,f.connection.encryptedAccessToken,f.policy.phoneNumberId,f.policy.wabaId,f.policy.businessId,f.policy.expectedPhoneE164])assert.ok(!encoded.includes(privateValue));\n assertDiagnosticNoEffects(f);\n}\n\ntest('diagnostic observes the exact runtime tuple after setup expiry without durable changes or a transport provider',async()=>{\n const f=await ownRuntimeDiagnosticFixture(),before=structuredClone({connection:f.connection,receipt:f.receipt,controls:f.controls});\n for(const key of ['META_OWN_COMPANY_ACCESS_TOKEN','OBRASAAS_META_OWN_COMPANY_POLICY','OBRASAAS_META_OWN_COMPANY_RELEASE'])delete f.environment[key];\n const result=await f.diagnose();assertClosed(result,f);\n assert.equal(result.codeVerificationState,'VERIFIED');assert.equal(result.registered,true);assert.equal(result.platformState,'CLOUD_API');assert.equal(result.displayMatchesExpected,true);assert.equal(result.operationalCheck,'PASSED');assert.equal(result.denialStage,'NONE');\n assert.deepEqual({connection:f.connection,receipt:f.receipt,controls:f.controls},before);\n assert.ok(f.reads.some(({sql})=>/FOR SHARE/.test(sql)));\n assert.equal(result.sendReply,undefined);assert.equal(result.inspect,undefined);assert.equal(result.ownOperationalAuthority,undefined);\n});\n\nfor(const [name,value,expected] of [['absent',undefined,'MISSING'],['expired literal','EXPIRED','EXPIRED'],['not verified','NOT_VERIFIED','NOT_VERIFIED'],['hostile unknown','provider-private-name-and-token','OTHER']])test('diagnostic safely observes '+name+' while strict runtime remains rejected with zero POST',async t=>{\n t.mock.method(console,'warn',()=>{});\n const f=await ownRuntimeDiagnosticFixture();if(value===undefined)delete f.phone.code_verification_status;else f.phone.code_verification_status=value;\n const result=await f.diagnose();assertClosed(result,f);assert.equal(result.codeVerificationState,expected);assert.equal(result.codeVerificationPresent,value!==undefined);assert.equal(result.operationalCheck,'REJECTED');assert.equal(result.denialStage,'VERIFICATION_STATUS');assert.equal(result.registered,true);\n await assert.rejects(f.provider.forConnection(await f.runtimeInput()),{code:'META_OWN_COMPANY_PHONE_REJECTED'});assertDiagnosticNoEffects(f);\n});\n\ntest('display equality uses the current exact normalizer without returning the foreign display',async t=>{\n t.mock.method(console,'warn',()=>{});const f=await ownRuntimeDiagnosticFixture();f.phone.display_phone_number='+5491100000001';\n const result=await f.diagnose();assertClosed(result,f);assert.equal(result.displayComparable,true);assert.equal(result.displayMatchesExpected,false);assert.equal(result.denialStage,'DISPLAY_PHONE_MATCH');assert.ok(!JSON.stringify(result).includes(f.phone.display_phone_number));\n await assert.rejects(f.provider.forConnection(await f.runtimeInput()),{code:'META_OWN_COMPANY_PHONE_REJECTED'});assertDiagnosticNoEffects(f);\n});\n\ntest('a provider error never becomes a private diagnostic witness',async()=>{\n const f=await ownRuntimeDiagnosticFixture();f.state.failRead=f.policy.wabaId+'/phone_numbers';\n await assert.rejects(f.diagnose(),{code:'META_CUSTOMER_PROVIDER_REJECTED'});assertDiagnosticNoEffects(f);\n});\n\ntest('foreign adapter DTO and staged error cannot substitute for an internal inspection witness',async()=>{\n const f=await ownRuntimeDiagnosticFixture();\n for(const adapter of [{async diagnoseOwnConnection(){return {codeVerificationState:'VERIFIED',registered:true,denialStage:'NONE'};}},{async diagnoseOwnConnection(){throw Object.assign(new WorkspaceError('META_OWN_COMPANY_PHONE_REJECTED',403),{stage:'VERIFICATION_STATUS',projection:{registered:true},raw:'private'});}}]){\n  const service=f.makeService(adapter);await assert.rejects(service.diagnoseRuntime(f.session,f.request));\n }\n assert.equal(f.calls.length,0);assertDiagnosticNoEffects(f);\n});\n\nfor(const [name,revoke] of [['issuer',f=>{f.controls.issuerActive=false;}],['receipt',f=>{f.controls.receiptPresent=false;}],['channel',f=>{f.channelState.mode='SUSPENDED';}],['ciphertext',f=>{f.controls.current={...f.connection,encryptedAccessToken:f.connection.encryptedAccessToken+'x'};}],['session',f=>{f.session.expiresAt=Math.floor(f.time/1000);}]] )test('authority loss after the last provider GET dominates the valid witness: '+name,async()=>{\n const f=await ownRuntimeDiagnosticFixture(),adapter={async diagnoseOwnConnection(input){const witness=await f.provider.diagnoseOwnConnection(input);revoke(f);return witness;}};\n const service=f.makeService(adapter);await assert.rejects(service.diagnoseRuntime(f.session,f.request),{code:'META_OWN_COMPANY_UNAVAILABLE'});assert.ok(f.calls.length>0);assertDiagnosticNoEffects(f);\n});\n\ntest('authority loss dominates a simultaneous provider error and never returns a partial projection',async()=>{\n const f=await ownRuntimeDiagnosticFixture();f.state.failRead=f.policy.wabaId+'/phone_numbers';\n const service=f.makeService({async diagnoseOwnConnection(input){try{return await f.provider.diagnoseOwnConnection(input);}finally{f.controls.issuerActive=false;}}});\n await assert.rejects(service.diagnoseRuntime(f.session,f.request),{code:'META_OWN_COMPANY_UNAVAILABLE'});assertDiagnosticNoEffects(f);\n});\n\nfor(const key of ['META_APP_SECRET','META_CUSTOMER_CREDENTIALS_KEY'])test('missing configuration '+key+' produces no observation and no provider GET',async()=>{\n const f=await ownRuntimeDiagnosticFixture();delete f.environment[key];await assert.rejects(f.diagnose());assert.equal(f.calls.length,0);assertDiagnosticNoEffects(f);\n});\n\ntest('current role, original issuer, anchor, scope and session expiry are required before any provider GET',async()=>{\n for(const mutate of [f=>{f.member.role='DIRECTOR';},f=>{f.member.actorId='another-admin';},f=>{f.session.userId='user_Other';},f=>{f.request.projectId='another-project';},f=>{f.request.scope='b'.repeat(64);},f=>{f.session.expiresAt=Math.floor(f.time/1000);}]){\n  const f=await ownRuntimeDiagnosticFixture();mutate(f);await assert.rejects(f.diagnose());assert.equal(f.calls.length,0);assertDiagnosticNoEffects(f);\n }\n});\n\n// Each substitution receives its own fresh witness.\nfor(const [name,alter] of [\n ['copied opaque handle',async(f,input,witness)=>({value:{...witness},context:input})],\n ['different capability object',async(f,input,witness)=>({value:witness,context:{...input,capability:await f.capability()}})],\n ['different token',async(f,input,witness)=>({value:witness,context:{...input,token:'synthetic-different-token-for-negative-only'}})],\n ['copied connection object',async(f,input,witness)=>({value:witness,context:{...input,connection:{...input.connection}}})],\n])test('private diagnostic witness rejects '+name+' independently',async()=>{\n const f=await ownRuntimeDiagnosticFixture(),input=await f.runtimeInput(),witness=await f.provider.diagnoseOwnConnection(input);\n const changed=await alter(f,input,witness);\n assert.throws(()=>projectOwnCompanyRuntimeDiagnostic(changed.value,{...changed.context,environment:f.environment,now:f.time}),{code:'META_OWN_COMPANY_UNAVAILABLE'});\n assertDiagnosticNoEffects(f);\n});\n\ntest('a fresh private diagnostic witness projects a closed DTO once and then rejects replay',async()=>{\n const f=await ownRuntimeDiagnosticFixture(),input=await f.runtimeInput(),witness=await f.provider.diagnoseOwnConnection(input);\n assert.deepEqual(witness,{});assert.equal(Object.getPrototypeOf(witness),Object.prototype);\n const result=projectOwnCompanyRuntimeDiagnostic(witness,{...input,environment:f.environment,now:f.time});\n assertClosed(result,f);assert.equal(result.codeVerificationState,'VERIFIED');assert.equal(result.operationalCheck,'PASSED');\n assert.throws(()=>projectOwnCompanyRuntimeDiagnostic(witness,{...input,environment:f.environment,now:f.time}),{code:'META_OWN_COMPANY_UNAVAILABLE'});\n assertDiagnosticNoEffects(f);\n});\n\ntest('revocation after the first fake Graph GET prevents every later GET and POST without durable DB writes',async()=>{\n const f=await ownRuntimeDiagnosticFixture();\n f.state.afterRead=path=>{if(f.calls.length===1){assert.equal(path,'debug_token');f.controls.issuerActive=false;}};\n await assert.rejects(f.diagnose(),{code:'META_OWN_COMPANY_UNAVAILABLE'});\n assert.deepEqual(f.calls,[{path:'debug_token',method:'GET'}]);\n assertDiagnosticNoEffects(f);\n});\n\ntest('expiry of the original 60-second lease between result and final fence cannot be renewed by a new capability',async()=>{\n const f=await ownRuntimeDiagnosticFixture();let originalCapability,newCapability;\n const service=f.makeService({async diagnoseOwnConnection(input){\n  originalCapability=input.capability;\n  const witness=await f.provider.diagnoseOwnConnection(input);\n  f.time+=60001;\n  // A fresh canonical resolver can still mint its own bounded request lease.\n  // It must not substitute for the captured lease of the in-flight request.\n  newCapability=await f.capability();\n  return witness;\n }});\n await assert.rejects(service.diagnoseRuntime(f.session,f.request),{code:'META_OWN_COMPANY_UNAVAILABLE'});\n assert.equal(ownCompanyCapabilityKind(newCapability),'RUNTIME');\n assert.notEqual(newCapability,originalCapability);\n assert.doesNotThrow(()=>ownCompanyTransportPolicy(newCapability,f.environment,f.time));\n assert.throws(()=>ownCompanyTransportPolicy(originalCapability,f.environment,f.time),{code:'META_OWN_COMPANY_UNAVAILABLE'});\n assertDiagnosticNoEffects(f);\n});\n\ntest('non-phone provider denials are not silently upgraded to diagnostic success',async()=>{\n const f=await ownRuntimeDiagnosticFixture();f.state.subscribed=false;\n await assert.rejects(f.diagnose(),{code:'META_OWN_COMPANY_OWNER_UNVERIFIED'});assertDiagnosticNoEffects(f);\n});\n\ntest('the existing GET exposes only narrow discovery with sanitized failures, no-store and unchanged cross-site rejection',async()=>{\n const f=await ownRuntimeDiagnosticFixture(),store=createCompanyChannelStore({workspace:{},ownConnection:f.service,environment:f.environment}),handlers=createCompanyChannelHandlers({verify:async()=>f.session,store});\n const base='https://obrasaas.com/api/identity/company-channel?'+new URLSearchParams({...f.request,discovery:'OWN_RUNTIME_DIAGNOSTIC'});\n const success=await handlers.GET(new Request(base));assert.equal(success.status,200);assert.match(success.headers.get('cache-control'),/private, no-store/);assertClosed(await success.json(),f);\n for(const url of [base+'&discovery=OWN_RUNTIME_DIAGNOSTIC',base+'&operationId=11111111-1111-4111-8111-111111111111',base+'&stage=VERIFICATION_STATUS'])assert.equal((await handlers.GET(new Request(url))).status,400);\n assert.equal((await handlers.GET(new Request(base,{headers:{'sec-fetch-site':'cross-site'}}))).status,403);\n f.state.failRead='debug_token';const denied=await handlers.GET(new Request(base));assert.notEqual(denied.status,200);assert.deepEqual(Object.keys(await denied.json()).sort(),['code','saved']);assertDiagnosticNoEffects(f);\n});\n",
            "previousText": ""
          }
        ]
      },
      {
        "path": "tests/production-own-company-runtime-provider.test.mjs",
        "status": "MODIFIED",
        "previousSha256": "82a0450564cd57f1927fc93ac6b73b4c2be74e136c853d751b4bbe52a6f6b034",
        "currentSha256": "b60b285e24d53a11be9aafd977df986319ab524c8fab40eb76411a70d9a8aa5d",
        "previousBytes": 19517,
        "currentBytes": 23950,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 10126,
            "currentText": "for(const [name,status] of [['unverified','NOT_VERIFIED'],['missing',undefined]])test('ADMIN '+name+' phone verification cannot mint operational authority through a forged inspection DTO',async()=>{\n const f=await fixture();f.calls.length=0;if(status===undefined)delete f.phone.code_verification_status;else f.phone.code_verification_status=status;\n const inspection=await f.admin.inspect({token:f.token,wabaId:f.policy.wabaId,phoneNumberId:f.policy.phoneNumberId});\n assert.equal(inspection.registered,true);assert.equal(inspection.platformType,'CLOUD_API');assert.equal(Object.hasOwn(inspection,'phoneCodeVerified'),false);\n assert.throws(()=>f.admin.ownOperationalAuthority(inspection),error=>error.code==='META_OWN_COMPANY_OWNER_UNVERIFIED');\n inspection.phoneCodeVerified=true;inspection.code_verification_status='VERIFIED';\n assert.throws(()=>f.admin.ownOperationalAuthority(inspection),error=>error.code==='META_OWN_COMPANY_OWNER_UNVERIFIED');\n assert.throws(()=>f.admin.ownOperationalAuthority({...inspection}),error=>error.code==='META_OWN_COMPANY_OWNER_UNVERIFIED');\n assert.equal(f.calls.filter(call=>call.method==='POST').length,0);\n});\n",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 15998,
            "currentText": "test('runtime verification status diagnostics contain only a fixed event and stage despite hostile provider data',async t=>{\n const logs=[];t.mock.method(console,'warn',value=>logs.push(value));\n for(const status of ['NOT_VERIFIED',undefined,'HOSTILE_PROVIDER_DATA']){\n  const f=await fixture();if(status===undefined)delete f.phone.code_verification_status;else f.phone.code_verification_status=status==='HOSTILE_PROVIDER_DATA'?[status,f.token,f.policy.expectedPhoneE164,f.policy.phoneNumberId].join('|'):status;\n  await assert.rejects(f.runtime(),error=>error.code==='META_OWN_COMPANY_PHONE_REJECTED');assert.equal(f.calls.filter(call=>call.method==='POST').length,0);\n }\n assert.ok(logs.every(value=>typeof value==='string'));assert.deepEqual(logs.map(value=>JSON.parse(value)),Array.from({length:3},()=>({event:'META_OWN_COMPANY_PHONE_REJECTED',version:1,stage:'VERIFICATION_STATUS'})));\n});\ntest('runtime display phone mismatch diagnostics never include the provider display or credentials',async t=>{\n const f=await fixture(),logs=[];t.mock.method(console,'warn',value=>logs.push(value));f.phone.display_phone_number='+5491100000001';f.phone.verified_name='HOSTILE_PROVIDER_NAME|'+f.token;\n await assert.rejects(f.runtime(),error=>error.code==='META_OWN_COMPANY_PHONE_REJECTED');assert.deepEqual(logs.map(value=>JSON.parse(value)),[{event:'META_OWN_COMPANY_PHONE_REJECTED',version:1,stage:'DISPLAY_PHONE_MATCH'}]);assert.equal(f.calls.filter(call=>call.method==='POST').length,0);\n});\ntest('superseded inspection diagnostics preserve rejection before normalizing the stale display', {timeout:5000},async t=>{\n const f=await fixture(),scoped=await f.runtime(),logs=[];t.mock.method(console,'warn',value=>logs.push(value));f.calls.length=0;f.phone.display_phone_number='HOSTILE_STALE_DISPLAY|'+f.token;\n let release,entered;const blocked=new Promise(resolve=>{release=resolve;}),observed=new Promise(resolve=>{entered=resolve;});let first=true;\n f.state.afterRead=async path=>{if(path===f.policy.wabaId+'/phone_numbers'&&first){first=false;entered();await blocked;}};\n const earlier=scoped.inspect({token:f.token,wabaId:f.policy.wabaId,phoneNumberId:f.policy.phoneNumberId}),denied=assert.rejects(earlier,error=>error.code==='META_OWN_COMPANY_PHONE_REJECTED');\n try{await observed;f.phone.display_phone_number=f.policy.expectedPhoneE164;await scoped.inspect({token:f.token,wabaId:f.policy.wabaId,phoneNumberId:f.policy.phoneNumberId});}finally{release();}\n await denied;assert.deepEqual(logs.map(value=>JSON.parse(value)),[{event:'META_OWN_COMPANY_PHONE_REJECTED',version:1,stage:'INSPECTION_SUPERSEDED'}]);assert.equal(f.calls.filter(call=>call.method==='POST').length,0);\n});\ntest('a failing private phone diagnostic reporter cannot change denials or permit a reply POST',async t=>{\n const warning=t.mock.method(console,'warn',()=>{throw Error('SYNTHETIC_PRIVATE_LOG_FAILURE');});\n for(const kind of ['verification','display']){const f=await fixture();if(kind==='verification')f.phone.code_verification_status='NOT_VERIFIED';else f.phone.display_phone_number='+5491100000001';await assert.rejects(f.runtime(),error=>error.code==='META_OWN_COMPANY_PHONE_REJECTED');assert.equal(f.calls.filter(call=>call.method==='POST').length,0);}\n assert.equal(warning.mock.callCount(),2);\n});\n",
            "previousText": ""
          }
        ]
      },
      {
        "path": "tests/production-own-runtime-source-advance.test.mjs",
        "status": "ADDED",
        "previousSha256": null,
        "currentSha256": "33ed8c1e6f966e6ccb90969f7d6e084e7d4d45b19ec83ba1d1e9aba1cf8d52fa",
        "previousBytes": 0,
        "currentBytes": 28053,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 0,
            "currentText": "import {verifyPlanMeasurementCurrentSources} from '../scripts/lib/plan-measurement-current-ci-lineage.mjs';\nimport {verifyFieldOutboundCurrentSources} from '../scripts/lib/field-outbound-current-ci-lineage.mjs';\nimport {verifyOoxmlAccountingCurrentSources} from '../scripts/lib/ooxml-accounting-current-ci-lineage.mjs';\nimport {verifyParticipantPreanalysisCurrentSources} from '../scripts/lib/participant-preanalysis-current-ci-lineage.mjs';\nimport {verifyIntegratedIdentityCurrentSources} from '../scripts/lib/integrated-identity-current-ci-lineage.mjs';\nimport {verifyDocumentTaskAssociationCurrentSources} from '../scripts/lib/plan-measurement-document-association-ci-lineage.mjs';\nimport {verifyWorkspaceContinuityCurrentSources} from '../scripts/lib/workspace-continuity-current-ci-lineage.mjs';\nimport {verifyWhatsappFieldContinuityCurrentSources} from '../scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs';\nimport {verifyExistingApiPlanCurrentSources} from '../scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs';\nimport {verifyMaterialReviewCurrentSources} from '../scripts/lib/material-review-current-ci-lineage.mjs';\nimport {verifyParticipantDraftSafetyCurrentSources,verifyCustomerPhoneSelectionCurrentSources,verifyHomeDecisionsCurrentSources,verifyCompanyOnboardingUxCurrentSources,verifyWeeklyCypCurrentSources,verifyProgressEvidenceWaitCurrentSources,verifyIdentityDestinationUxCurrentSources,customerPhoneSelectionCurrentSourcePin,customerPhoneSelectionPreviousSourcePin} from '../scripts/lib/home-decisions-current-ci-lineage.mjs';\nimport test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {readFileSync} from 'node:fs';\nimport {createHash} from 'node:crypto';\nimport {focusedWorkspaceCiLocalImports} from '../scripts/verify-focused-workspace-ci.mjs';\nimport {fieldTaskPaginationCiLocalImports} from '../scripts/verify-field-task-pagination-ci.mjs';\nimport {worksiteLiveHoursCurrentSourcePin,worksiteLiveHoursPreviousSourcePin,verifyWorksiteLiveHoursCurrentSources} from '../scripts/lib/worksite-live-hours-current-ci-lineage.mjs';\nimport {planPartidaPreviewCurrentSourcePin,planPartidaPreviewPreviousSourcePin,verifyPlanPartidaPreviewCurrentSources} from '../scripts/lib/plan-partida-preview-current-ci-lineage.mjs';\nimport {restoreOwnRuntimeDiagnosticPreviousContract,planBudgetValidationFiles,verifyPlanBudgetCurrentSources,verifyPlanBudgetActualClosure,restorePlanBudgetPreviousContract,planBudgetCurrentSourcePin,planBudgetPreviousSourcePin,restorePlanBudgetSourceSet,planBudgetProofSourceAdditions} from '../scripts/lib/plan-budget-current-ci-lineage.mjs';\n\nconst baseHash='75140c878ebd4792bf59da6aa4dbc0f2db082963c8518acf867cffc7f78f5ac0',reviewedHash='f0c0c1e40171f3ed6d2af16bed2504eaf640ce9dff9995b33bd4c76d90b664da',parentHash='8b19235b22aa3c208098283537511fe1c816f7ff86404790a98999f0e818f839';\nconst read=file=>readFileSync(new URL('../'+file,import.meta.url)),hash=value=>createHash('sha256').update(value).digest('hex'),contract=JSON.parse(read('.github/workspace-acceptance-contract.json')),section=contract.planBudgetCurrentRevision,advance=section.ownRuntimeDiagnosticAdvance,clone=structuredClone;\nconst budgetRejected=error=>error?.code==='PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED';\nfunction oppositeRaw(bytes){const text=bytes.toString(),normalized=text.replaceAll('\\r\\n','\\n'),other=Buffer.from(text.includes('\\r\\n')?normalized:normalized.replaceAll('\\n','\\r\\n'));assert.equal(other.equals(bytes),false);assert.equal(other.toString().replaceAll('\\r\\n','\\n'),normalized);return other;}\nfunction replacePointer(value,pointer,expected,next){const keys=pointer.slice(1).split('/');let at=value;for(const key of keys.slice(0,-1))at=at[key];assert.deepEqual(at[keys.at(-1)],expected);at[keys.at(-1)]=clone(next);}\nfunction baseline(){const value=clone(contract);delete value.planBudgetCurrentRevision.ownRuntimeDiagnosticAdvance;for(const p of advance.metadataInverse.toReversed())replacePointer(value,p.pointer,p.after,p.before);return value;}\nfunction previousBytes(file){if(file==='scripts/lib/plan-budget-current-ci-reviewed.mjs')return Buffer.from('// Exact budget-source CI declaration; compiler fills immutable reviewed source bindings.\\nexport const PLAN_BUDGET_CURRENT_REVISION=Object.freeze('+JSON.stringify(baseline().planBudgetCurrentRevision,null,2)+');\\n');const source=advance.sourceChanges.find(row=>row.path===file);if(!source)return read(file);let text=read(file).toString().replaceAll('\\r\\n','\\n');for(const h of source.inverseHunks.toReversed()){assert.equal(text.slice(h.currentOffsetCharacters,h.currentOffsetCharacters+h.currentText.length),h.currentText);text=text.slice(0,h.currentOffsetCharacters)+h.previousText+text.slice(h.currentOffsetCharacters+h.currentText.length);}return source.previousSha256===null?null:Buffer.from(text);}\n\ntest('public current verifier authenticates physical source advance and restores both exact historical contracts',()=>{\n assert.equal(advance.sourceChanges.length,23);assert.deepEqual(advance.retainedDependencies.map(row=>({path:row.path,sha256:row.sha256,bytes:row.bytes})),[{\"path\":\"src/app/(identity)/cuenta/kyc-camera-session.mjs\",\"sha256\":\"e84404979093aaad5179cf47433b3930ddc71e7677fe36db6018fcd49bf8e5c4\",\"bytes\":4136},{\"path\":\"src/app/(identity)/cuenta/kyc-photo-preparation.js\",\"sha256\":\"d88c55b9fb97b6b1abb5ecb02cf66b9d8e016821525f1b6a3cc2a381e641c4e5\",\"bytes\":12504},{\"path\":\"src/app/(identity)/cuenta/participant-kyc-capture.js\",\"sha256\":\"556109c32d2f85be4b043513362d682ed7e14811a21a6f08200ac65c53af5d48\",\"bytes\":4864},{\"path\":\"src/app/(identity)/cuenta/participant-panel.js\",\"sha256\":\"1ec30c252d7f0fa8d65905f66eeca76da1644778b9ad710da5487ab667759c82\",\"bytes\":106608},{\"path\":\"src/app/(identity)/cuenta/participant-panel.module.css\",\"sha256\":\"31ef143f21af5f6ed0aba4f11bf1cf79549ae97c462ed0bef2daaf3e67635250\",\"bytes\":6728},{\"path\":\"src/app/(identity)/cuenta/workspace-client.js\",\"sha256\":\"f9acac2e8589afce076c51e07ef2bd4c3a67360faa9970b2cbbd447502c98bc0\",\"bytes\":75429}]);const result=verifyPlanBudgetCurrentSources(contract,read);assert.equal(result.completePreviousContractRestored,true);assert.equal(result.previousContractSha256,parentHash);\n const prior=baseline();assert.equal(hash(JSON.stringify(prior,null,2)+'\\n'),baseHash);assert.equal(hash(previousBytes('scripts/lib/plan-budget-current-ci-reviewed.mjs')),reviewedHash);assert.equal(hash(JSON.stringify(restorePlanBudgetPreviousContract(contract),null,2)+'\\n'),parentHash);\n assert.deepEqual(verifyPlanBudgetCurrentSources(prior,previousBytes),{completePreviousContractRestored:true,previousContractSha256:parentHash,referenceCount:85,nativeOrBrowserAcceptance:false});\n});\ntest('all16 declared family DTOs validate positive physical sources before adversarial source checks',()=>{\n // Declared DTOs, not independent AST membership evidence. The separate22-source audit supplies that.\n assert.equal(section.sourceFamilies.length,16);for(const family of section.sourceFamilies){const result=verifyPlanBudgetActualClosure(contract,family.family,{files:clone(family.currentFiles),externalImports:clone(family.externalImports)},read);assert.equal(result.family,family.family);assert.equal(result.sourceCount,family.currentFiles.length);assert.equal(result.sourcePathsSha256,hash(JSON.stringify(family.currentFiles)));}\n});\ntest('public pin aliases preserve b6 to102 lineage and bind only the declared new endpoint',()=>{\n const file='src/lib/meta-customer-provider.mjs',old=section.references.find(row=>row.path===file),now=advance.sourceChanges.find(row=>row.path===file);assert.equal(old.previousSha256,'b6cc572fb68ab4cb653ccee30cea754a6273b5631d13e61dd2c2f65535aa287f');assert.equal(old.currentSha256,'102ae45ad7d0a1054d2c65cdbfa3a6a96accfcd982bebce8d6c32c7bf24b21a2');assert.equal(now.previousSha256,old.currentSha256);\n for(const sha256 of [old.previousSha256,old.currentSha256,now.currentSha256])assert.equal(planBudgetCurrentSourcePin(contract,{path:file,sha256}),now.currentSha256);\n assert.equal(planBudgetPreviousSourcePin(contract,{path:file,sha256:now.currentSha256}),old.previousSha256);\n for(const fn of [planBudgetCurrentSourcePin,planBudgetPreviousSourcePin])assert.throws(()=>fn(contract,{path:file,sha256:'f'.repeat(64)}),budgetRejected);\n for(const changed of advance.sourceChanges.filter(s=>s.status==='MODIFIED'))assert.throws(()=>planBudgetCurrentSourcePin(contract,{path:changed.path,sha256:'f'.repeat(64)}),budgetRejected);\n});\ntest('all20 real contract-based outer source verifiers accept the current composed physical source tree',()=>{\n // Executes actual public source authority with the full current contract and\n // filesystem reader; this is separate from declared-family DTO and22AST checks.\n const before=JSON.stringify(contract),verifiers=[['verifyPlanBudgetCurrentSources',verifyPlanBudgetCurrentSources],['verifyPlanPartidaPreviewCurrentSources',verifyPlanPartidaPreviewCurrentSources],['verifyWorksiteLiveHoursCurrentSources',verifyWorksiteLiveHoursCurrentSources],['verifyParticipantDraftSafetyCurrentSources',verifyParticipantDraftSafetyCurrentSources],['verifyCustomerPhoneSelectionCurrentSources',verifyCustomerPhoneSelectionCurrentSources],['verifyHomeDecisionsCurrentSources',verifyHomeDecisionsCurrentSources],['verifyCompanyOnboardingUxCurrentSources',verifyCompanyOnboardingUxCurrentSources],['verifyWeeklyCypCurrentSources',verifyWeeklyCypCurrentSources],['verifyProgressEvidenceWaitCurrentSources',verifyProgressEvidenceWaitCurrentSources],['verifyIdentityDestinationUxCurrentSources',verifyIdentityDestinationUxCurrentSources],['verifyMaterialReviewCurrentSources',verifyMaterialReviewCurrentSources],['verifyExistingApiPlanCurrentSources',verifyExistingApiPlanCurrentSources],['verifyWhatsappFieldContinuityCurrentSources',verifyWhatsappFieldContinuityCurrentSources],['verifyWorkspaceContinuityCurrentSources',verifyWorkspaceContinuityCurrentSources],['verifyDocumentTaskAssociationCurrentSources',verifyDocumentTaskAssociationCurrentSources],['verifyIntegratedIdentityCurrentSources',verifyIntegratedIdentityCurrentSources],['verifyParticipantPreanalysisCurrentSources',verifyParticipantPreanalysisCurrentSources],['verifyOoxmlAccountingCurrentSources',verifyOoxmlAccountingCurrentSources],['verifyFieldOutboundCurrentSources',verifyFieldOutboundCurrentSources],['verifyPlanMeasurementCurrentSources',verifyPlanMeasurementCurrentSources]];assert.equal(verifiers.length,20);let completed=0;\n for(const [name,verify]of verifiers){const result=verify(contract,read);assert.ok(result&&typeof result==='object',name);if(Object.hasOwn(result,'nativeOrBrowserAcceptance'))assert.equal(result.nativeOrBrowserAcceptance,false,name);assert.equal(JSON.stringify(contract),before,name);completed++;}assert.equal(completed,20);\n});\ntest('physical source omission corruption and final-read mutation fail through the real public verifier',()=>{\n for(const {path:file} of advance.sourceChanges){\n  assert.throws(()=>verifyPlanBudgetCurrentSources(contract,p=>p===file?null:read(p)),budgetRejected);\n  assert.throws(()=>verifyPlanBudgetCurrentSources(contract,p=>p===file?Buffer.concat([read(p),Buffer.from('\\n// altered physical bytes\\n')]):read(p)),budgetRejected);\n }\n const file='tests/production-own-runtime-source-advance.test.mjs';let reads=0;assert.throws(()=>verifyPlanBudgetCurrentSources(contract,p=>p===file&&++reads>1?oppositeRaw(read(p)):read(p)),error=>budgetRejected(error)&&error.reason==='OWN_SOURCE_CHANGED_DURING_CALL');assert.ok(reads>=2);\n});\ntest('physical companion mismatch is rejected independently of the caller declaration',()=>{\n const file='scripts/lib/plan-budget-current-ci-reviewed.mjs';assert.throws(()=>verifyPlanBudgetCurrentSources(contract,p=>p===file?Buffer.concat([read(p),Buffer.from('\\n')]):read(p)),budgetRejected);\n});\ntest('closure verifier keeps its RAW fence and caller mutation denial on declared shadow closure input',()=>{\n // This DTO exercises the public validator; independent actual AST closure\n // collection is an explicitly separate post-apply22-producer check.\n const f=section.sourceFamilies[0],closure={files:clone(f.currentFiles),externalImports:clone(f.externalImports)},file='tests/production-own-runtime-source-advance.test.mjs';let reads=0;\n assert.throws(()=>verifyPlanBudgetActualClosure(contract,f.family,closure,p=>p===file&&++reads>1?oppositeRaw(read(p)):read(p)),error=>budgetRejected(error)&&error.reason==='OWN_SOURCE_CHANGED_DURING_CALL');\n const changed=clone(contract);let mutated=false,finalReads=0;assert.throws(()=>verifyPlanBudgetCurrentSources(changed,p=>{if(p===file){finalReads++;if(!mutated){mutated=true;changed.sourceCommit='f'.repeat(40);}}return read(p);}),error=>budgetRejected(error)&&error.reason==='OWN_CALLER_METADATA_CHANGED');assert.ok(finalReads>=2);\n});\ntest('omitted extra source advances and inverse-delta changes cannot become caller authority',()=>{\n for(const edit of [a=>a.sourceChanges.pop(),a=>a.sourceChanges.push(clone(a.sourceChanges[0])),a=>a.metadataInverse.pop(),a=>a.metadataInverse.push(clone(a.metadataInverse[0])),a=>a.sourceChanges[0].inverseHunks[0].previousText+='foreign']){const changed=clone(contract);edit(changed.planBudgetCurrentRevision.ownRuntimeDiagnosticAdvance);assert.throws(()=>verifyPlanBudgetCurrentSources(changed,read),budgetRejected);}\n});\ntest('only the reviewed view and retained camera additions restore the unchanged older source-set ledger',()=>{\n const prior=baseline();assert.equal(hash(JSON.stringify(prior,null,2)+'\\n'),baseHash);assert.equal(hash(JSON.stringify(prior.planBudgetCurrentRevision.sourceSetDeltas.filter(r=>r.family!=='CONSUMPTION_FEEDBACK_UI'))),'380e99f8cf321760f4b64c8e52810d4ceb9e0890d8059dce1ca549a568b56cbd');\n for(const [index,additions]of [[3,['src/app/(identity)/cuenta/kyc-camera-session.mjs']],[13,['src/app/(identity)/cuenta/kyc-camera-session.mjs','src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs']],[18,['src/app/(identity)/cuenta/kyc-camera-session.mjs']],[19,['src/app/(identity)/cuenta/kyc-camera-session.mjs','src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs']]]){const proof=contract.extension.proofs[index],old=prior.extension.proofs[index],delta=prior.planBudgetCurrentRevision.sourceSetDeltas.find(r=>r.family===proof.kind),historical=old.sourceFiles.filter(file=>!delta.additions.includes(file));assert.equal(hash(JSON.stringify(historical)),delta.previousPathsSha256);assert.deepEqual(proof.sourceFiles,[...old.sourceFiles,...additions].sort());assert.deepEqual(planBudgetProofSourceAdditions(proof),[...delta.additions,...additions].sort());assert.deepEqual(restorePlanBudgetSourceSet(contract,proof.kind,proof.sourceFiles),historical);for(const files of [proof.sourceFiles.filter(f=>f!==additions[0]),[...proof.sourceFiles,'src/foreign.mjs'].sort()]){const changed=clone(contract);changed.extension.proofs[index].sourceFiles=files;assert.throws(()=>restorePlanBudgetPreviousContract(changed),budgetRejected);}}\n for(const index of [0,4]){const current=section.sourceFamilies[index],old=prior.planBudgetCurrentRevision.sourceFamilies[index],delta=prior.planBudgetCurrentRevision.sourceSetDeltas.find(r=>r.family===current.family);assert.equal(hash(JSON.stringify(old.previousFiles)),delta.previousPathsSha256);assert.deepEqual(restorePlanBudgetSourceSet(contract,current.family,current.currentFiles),old.previousFiles);}\n});\ntest('dependency hash changes cannot bypass the exact0707 and8b19 inverses',()=>{\n const current=advance.sourceChanges.find(row=>row.path==='package-lock.json');assert.equal(contract.packageLockSha256,current.currentSha256);assert.equal(baseline().packageLockSha256,current.previousSha256);\n const changed=clone(contract);changed.packageLockSha256='f'.repeat(64);assert.throws(()=>restorePlanBudgetPreviousContract(changed),budgetRejected);\n});\n\ntest('the unchanged camera dependency has an exact independent pin and before-final RAW fence',()=>{\n const {path:file,sha256}=advance.retainedDependencies.find(row=>row.path.endsWith('/kyc-camera-session.mjs'));assert.equal(advance.sourceChanges.some(row=>row.path===file),false);assert.equal(hash(read(file).toString().replaceAll('\\r\\n','\\n')),sha256);assert.equal(planBudgetCurrentSourcePin(contract,{path:file,sha256}),sha256);assert.throws(()=>planBudgetCurrentSourcePin(contract,{path:file,sha256:'f'.repeat(64)}),budgetRejected);\n for(const {path:retainedFile}of advance.retainedDependencies){for(const fn of [planBudgetCurrentSourcePin,planBudgetPreviousSourcePin])assert.throws(()=>fn(contract,{path:retainedFile,sha256:'f'.repeat(64)}),budgetRejected);for(const reader of [p=>p===retainedFile?null:read(p),p=>p===retainedFile?Buffer.concat([read(p),Buffer.from('\\n// foreign\\n')]):read(p)])assert.throws(()=>verifyPlanBudgetCurrentSources(contract,reader),budgetRejected);}\n let reads=0;assert.throws(()=>verifyPlanBudgetCurrentSources(contract,p=>p===file&&++reads>1?oppositeRaw(read(p)):read(p)),error=>budgetRejected(error)&&error.reason==='OWN_SOURCE_CHANGED_DURING_CALL');assert.ok(reads>=2);\n for(const edit of [a=>a.retainedDependencies.pop(),a=>a.retainedDependencies.push(clone(a.retainedDependencies[0])),a=>a.retainedDependencies[0].sha256='f'.repeat(64)]){const changed=clone(contract);edit(changed.planBudgetCurrentRevision.ownRuntimeDiagnosticAdvance);assert.throws(()=>verifyPlanBudgetCurrentSources(changed,read),budgetRejected);}\n});\ntest('retained workspace metadata aliases compose through real Partida and Worksite owners',()=>{\n const path='src/app/(identity)/cuenta/workspace-client.js',earlier='e53ad474a3677243fbcaff6ce526c0983514d42e78c6daf60e73ba06d6f63bec',previous='2fe5a56a7caf7d46f11e4292d2e145e3e72072198a09f9951ace42c2613e8db9',current='f9acac2e8589afce076c51e07ef2bd4c3a67360faa9970b2cbbd447502c98bc0';\n for(const sha256 of [earlier,previous,current])for(const fn of [planBudgetCurrentSourcePin,planPartidaPreviewCurrentSourcePin,worksiteLiveHoursCurrentSourcePin])assert.equal(fn(contract,{path,sha256}),current);\n assert.equal(planBudgetPreviousSourcePin(contract,{path,sha256:current}),previous);assert.equal(planPartidaPreviewPreviousSourcePin(contract,{path,sha256:current}),previous);assert.equal(worksiteLiveHoursPreviousSourcePin(contract,{path,sha256:current}),earlier);\n const retained=advance.retainedDependencies.find(row=>row.path.endsWith('/kyc-camera-session.mjs'));assert.equal(planBudgetPreviousSourcePin(contract,{path:retained.path,sha256:retained.sha256}),retained.sha256);\n});\ntest('both real controlled SWC import guards bind the corrected physical compiler lock through Budget',()=>{\n for(const [fn,file,kind]of [[focusedWorkspaceCiLocalImports,'tests/production-company-bootstrap-receipt.test.mjs','FOCUSED_WORKSPACE_CI_REJECTED'],[fieldTaskPaginationCiLocalImports,'tests/production-worksite-task-selector.test.mjs','FIELD_TASK_PAGINATION_CI_REJECTED']]){\n  const legacyLock=previousBytes('package-lock.json'),component='src/app/(identity)/cuenta/'+(file.includes('bootstrap')?'company-bootstrap-panel.js':'worksite-task-selector.js');assert.ok(fn(read(file),file,p=>p==='package-lock.json'?legacyLock:p===component?read(p):null).includes('../'+component));const strict=p=>{if(p==='package-lock.json')return legacyLock;if(p===component)return read(p);throw new Error('Historical reader does not support '+p);};assert.ok(fn(read(file),file,strict).includes('../'+component));for(const metadata of [Buffer.from('{'),Buffer.from('null'),Buffer.from('[]'),'non-buffer'])assert.throws(()=>fn(read(file),file,p=>p==='.github/workspace-acceptance-contract.json'?metadata:p==='package-lock.json'?legacyLock:p===component?read(p):null),error=>error.code===kind);assert.throws(()=>fn(read(file),file,p=>p==='package-lock.json'?legacyLock:(()=>{try{return read(p);}catch{return null;}})()),error=>error.code===kind);\n  const actual=fn(read(file),file,p=>{try{return read(p);}catch{return null;}});assert.ok(actual.includes('../'+(file.includes('bootstrap')?'src/app/(identity)/cuenta/company-bootstrap-panel.js':'src/app/(identity)/cuenta/worksite-task-selector.js')));\n  assert.throws(()=>fn(read(file),file,p=>p==='package-lock.json'?Buffer.concat([read(p),Buffer.from('\\n')]):(()=>{try{return read(p);}catch{return null;}})()),error=>error.code===kind);\n  const shared=Buffer.from(read('.github/workspace-acceptance-contract.json'));let changedBuffer=false;assert.throws(()=>fn(read(file),file,p=>{if(p==='.github/workspace-acceptance-contract.json')return shared;if(p==='package-lock.json'&&!changedBuffer){changedBuffer=true;shared[0]=shared[0]===123?91:123;}try{return read(p);}catch{return null;}}),error=>error.code===kind);assert.equal(changedBuffer,true);\n  const fake=clone(contract);fake.planBudgetCurrentRevision.ownRuntimeDiagnosticAdvance.sourceChanges.find(row=>row.path==='package-lock.json').currentSha256='f'.repeat(64);assert.throws(()=>fn(read(file),file,p=>p==='.github/workspace-acceptance-contract.json'?Buffer.from(JSON.stringify(fake)):(()=>{try{return read(p);}catch{return null;}})()),error=>error.code===kind);\n }\n});\ntest('only exact same-path historical CI metadata inputs preserve every previous owner endpoint',()=>{\n const rows=[{\"path\":\"scripts/verify-focused-workspace-ci.mjs\",\"baselineSha256\":\"532e37e994540a6fecd8c70d067730cddec4a66403686113cef4087828c2229c\",\"pins\":[\"3b9c0a1fa09e4cdd7eb731270d18c36e5f2bfbf480aa156447f3d02048a8a92d\",\"48650c362bfc0b9d8fd49976fbc4ae1a124776167c60ba08f60d2b163ee94e24\",\"a4eb59cb781eeb9578e46ffcdec21833cce1ba79eb9f99e3543fda799dfc62f4\",\"b7d134ed370e7984f8aed315127b82e4d2bdebe20a6d0d79a7453bf7e1f63dab\"]},{\"path\":\"scripts/verify-field-task-pagination-ci.mjs\",\"baselineSha256\":\"1e366a583be909323327524a8fe04db9eb962724ec5073bdf3eb36140ddcdecc\",\"pins\":[\"fe25cce6cecd014c923852c09f7eccb9431efd33805eb8bbad03bea79997a94d\"]}];assert.equal(rows.length,2);\n for(const row of rows){const current=advance.sourceChanges.find(source=>source.path===row.path);assert.equal(current.previousSha256,row.baselineSha256);for(const sha256 of [...row.pins,row.baselineSha256]){assert.equal(planBudgetCurrentSourcePin(contract,{path:row.path,sha256}),current.currentSha256);assert.equal(planBudgetPreviousSourcePin(contract,{path:row.path,sha256}),sha256);}assert.equal(planBudgetPreviousSourcePin(contract,{path:row.path,sha256:current.currentSha256}),row.baselineSha256);const foreign=rows.find(other=>other.path!==row.path).pins[0];for(const fn of [planBudgetCurrentSourcePin,planBudgetPreviousSourcePin])for(const sha256 of [foreign,'f'.repeat(64)])assert.throws(()=>fn(contract,{path:row.path,sha256}),budgetRejected);}\n});\ntest('the historical customer-provider input transits through Selection without widening the Budget current pair',()=>{\n const path='src/lib/meta-customer-provider.mjs',old='131ddc2c6344bc1e58a6ea17aa665f9e8585a0aabee7300eaa050c06ab85470a',current=advance.sourceChanges.find(row=>row.path===path).currentSha256;\n assert.equal(customerPhoneSelectionCurrentSourcePin(contract,{path,sha256:old}),current);assert.equal(customerPhoneSelectionPreviousSourcePin(contract,{path,sha256:old}),old);assert.equal(planBudgetPreviousSourcePin(contract,{path,sha256:old}),old);assert.throws(()=>planBudgetCurrentSourcePin(contract,{path,sha256:old}),budgetRejected);\n for(const fn of [customerPhoneSelectionCurrentSourcePin,customerPhoneSelectionPreviousSourcePin])assert.throws(()=>fn(contract,{path,sha256:'f'.repeat(64)}),error=>error?.code==='HOME_DECISIONS_CURRENT_CI_LINEAGE_REJECTED');for(const fn of [planBudgetCurrentSourcePin,planBudgetPreviousSourcePin])assert.throws(()=>fn(contract,{path:'scripts/verify-focused-workspace-ci.mjs',sha256:old}),budgetRejected);\n});\n\ntest('the readonly own projection restores complete0707 metadata with immutable caller and required current bytes',()=>{\n const before=JSON.stringify(contract),prior=restoreOwnRuntimeDiagnosticPreviousContract(contract,read);assert.equal(hash(JSON.stringify(prior,null,2)+'\\n'),baseHash);assert.deepEqual(prior,baseline());assert.equal(JSON.stringify(contract),before);assert.notEqual(prior,contract);assert.throws(()=>restoreOwnRuntimeDiagnosticPreviousContract(prior,previousBytes),error=>budgetRejected(error)&&error.reason==='OWN_ADVANCE_REQUIRED');\n const edited=clone(contract);edited.planBudgetCurrentRevision.ownRuntimeDiagnosticAdvance.sourceChanges.pop();assert.throws(()=>restoreOwnRuntimeDiagnosticPreviousContract(edited,read),budgetRejected);\n for(const row of [...advance.sourceChanges,...advance.retainedDependencies])assert.throws(()=>restoreOwnRuntimeDiagnosticPreviousContract(contract,file=>file===row.path?null:read(file)),budgetRejected);\n});\n\ntest('the exact validation enumeration includes every retained dependency and supports its own limited reader',()=>{\n const expected=[...new Set(['scripts/lib/plan-budget-current-ci-reviewed.mjs',...section.references.map(row=>row.path),...advance.sourceChanges.map(row=>row.path),...advance.retainedDependencies.map(row=>row.path)])].sort(),files=planBudgetValidationFiles(contract);assert.deepEqual(files,expected);assert.equal(files.length,109);const allowed=new Set(files),limited=file=>allowed.has(file)?read(file):null;assert.equal(verifyPlanBudgetCurrentSources(contract,limited).referenceCount,85);assert.equal(hash(JSON.stringify(restoreOwnRuntimeDiagnosticPreviousContract(contract,limited),null,2)+'\\n'),baseHash);\n});\n\ntest('historical test inputs transit only through Previous until their exact original owners advance them',()=>{\n const rows=[{\"path\":\"tests/production-material-review-current-ci-lineage.test.mjs\",\"baselineSha256\":\"cd3f36d1a26c2b2c82a27537566b9221245a6747012bf9e641fc8c0d73ea565e\",\"previousPairSha256\":\"a9d434e05848d2d2170d57a9410c8ddeecf4585949a645cb1fdf0480b2e58db9\",\"pins\":[\"09507a383397841240acc1a800da5fda19f2bab4a6e9f803ec73c37aa307f9f5\",\"3064ebedd2ab050d4d2e1326643d9b4d83d699a3a1f08489fe89b1bfadf45069\",\"38012a323a305bd8e41dcc04bc698b50dcac04110cec2cb7db93c8fa0f1e7ffa\",\"d4ff4dd321b7e7499cd2aed817abc0f5aab47b94e38d9d88c72d694d1768b0a1\"]},{\"path\":\"tests/production-meta-existing-api-plan-current-ci-lineage.test.mjs\",\"baselineSha256\":\"00d21d855c36f8020bd1791ed3b48b90901f7e017c0611d2df33a3a13ab1978d\",\"previousPairSha256\":\"dabe6caf8e2a216aa1d7160551431ce3e3b198b09b397f8c10edfeb9d9928650\",\"pins\":[\"6559fc99b2e4c40762b8b3a9dfbb6b542847ac08ab54d39e7461035e33b513f2\",\"ab3984d2393131261baa298b9408394b695cbca9f8e06d54ddac563c20c41587\",\"b321b7dfb5c82333883f2008b5dfe9e00b6d8aba31c920bd3484e397bf5dd1ed\"]},{\"path\":\"tests/production-participant-preanalysis-current-ci-lineage.test.mjs\",\"baselineSha256\":\"ea91b9b98adffaf408f85d60982577ba4befe044fa3d0f1a34c0d1daa017c574\",\"previousPairSha256\":\"568a07b2a88be7c9a0f217ce2b49fc61dbdeca8d6d1891dc63d0752f0efff9b4\",\"pins\":[\"12e14b7574906a4492b73437feea48478e2e05447456fdd7fbbce11eb61a5fa5\",\"6cb2d234dd3eee662cab7d713da8477c9c4933f176b519ee3f456c0619cccaca\",\"b509f96f600364d0327b4d3c2ac411fc2b32137b5e38fb4c2d47e3bf046cbd06\",\"c6fd915fe04bd3ee48c9490c8e1e43e8ad44f0d2597bf1675c79e8db6880dd46\"]},{\"path\":\"tests/production-whatsapp-field-continuity-current-ci-lineage.test.mjs\",\"baselineSha256\":\"a0e817f4f0ea3bae2a8042447a38ad099fb448a9ec8d34c0fd8e0b754685a497\",\"previousPairSha256\":\"43e1b60497a81d1598674fc3500b8ed47fa9be807c03788641ff5cf12c129521\",\"pins\":[\"15c2404c6ae43b86207f8e26915e642c6b1efa752e579e59d76fc50655e14b9b\",\"63d8b5b1c3e8f3f38add5c66b0901ea4477a7e7c9eb394ed6f02a4a4ee2b8acb\",\"6e8a12fc32a3eb57f146d31788ff2a2c8396f72763953e7ee0d9e76a4c896c71\",\"d55968747a2bfc23f02de49d0418374665e2db7e156cfa0356c21145cc9c83b4\"]}];assert.equal(rows.reduce((n,row)=>n+row.pins.length,0),15);for(const row of rows){for(const sha256 of row.pins){assert.equal(planBudgetPreviousSourcePin(contract,{path:row.path,sha256}),sha256);assert.throws(()=>planBudgetCurrentSourcePin(contract,{path:row.path,sha256}),budgetRejected);}assert.throws(()=>planBudgetPreviousSourcePin(contract,{path:row.path,sha256:'f'.repeat(64)}),budgetRejected);const other=rows.find(other=>other.path!==row.path).pins[0];assert.throws(()=>planBudgetPreviousSourcePin(contract,{path:row.path,sha256:other}),budgetRejected);}\n});\n",
            "previousText": ""
          }
        ]
      },
      {
        "path": "tests/production-participant-preanalysis-current-ci-lineage.test.mjs",
        "status": "MODIFIED",
        "previousSha256": "ea91b9b98adffaf408f85d60982577ba4befe044fa3d0f1a34c0d1daa017c574",
        "currentSha256": "c9f5e49c2fb8174c66262bb888ac912cb374d6cb7be42a6674336d3e0031fab0",
        "previousBytes": 27591,
        "currentBytes": 28719,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 8,
            "currentText": "restoreOwnRuntimeDiagnosticPreviousContract,planBudgetCurrentSourcePin,",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 13487,
            "currentText": "actual=JSON.parse(read('.github/workspace-acceptance-contract.json')),contract=restoreOwnRuntimeDiagnosticPreviousContract(actual,read),result=validateParticipantPreanalysisWorkspaceContract(actual);for(const index of [19,20]){const live=actual.extension.proofs[index],prior=contract.extension.proofs[index];assert.equal(live.producerSha256,planBudgetCurrentSourcePin(actual,{path:live.producer,sha256:prior.producerSha256}));assert.equal(sha(read(live.producer).toString().replaceAll('\\r\\n','\\n')),live.producerSha256);}for(const index of [3,13,18,19]){const delta=actual.planBudgetCurrentRevision.ownRuntimeDiagnosticAdvance.metadataInverse.find(row=>row.pointer==='/extension/proofs/'+index+'/sourceFiles');assert.deepEqual(contract.extension.proofs[index].sourceFiles,delta.before);assert.deepEqual(actual.extension.proofs[index].sourceFiles,[...delta.before,...delta.after.filter(file=>!delta.before.includes(file))].sort());}",
            "previousText": "contract=JSON.parse(read('.github/workspace-acceptance-contract.json')),result=validateParticipantPreanalysisWorkspaceContract(contract);"
          },
          {
            "currentOffsetCharacters": 15573,
            "currentText": "actual",
            "previousText": "contract"
          },
          {
            "currentOffsetCharacters": 20920,
            "currentText": "actual=JSON.parse(read('.github/workspace-acceptance-contract.json')),contract=restoreOwnRuntimeDiagnosticPreviousContract(actual,read),ownBaseSpec=contract.extension.proofs.find(row=>row.id===f.context.spec.id),historical=structuredClone(contract.participantPreanalysisCurrentRevision.nativeSourceFiles),current=participantPreanalysisNativeSourceClosure(f.context.readSource),rawBefore=Buffer.from(f.evidence.get(f.proof.rawNative.path)),referenceBefore=structuredClone(f.proof.rawNative),proofBefore=JSON.stringify(f.proof);\n const outer=contract[PLAN_PARTIDA_PREVIEW_CURRENT_SECTION].sourceSetDeltas.find(row=>row.family===f.context.spec.kind),budget=contract[PLAN_BUDGET_CURRENT_SECTION].sourceSetDeltas.find(row=>row.family===f.context.spec.kind),beforeBudgetFullCi=restorePlanBudgetSourceSet(contract,ownBaseSpec.kind,ownBaseSpec.sourceFiles),historicalFullCi=restorePlanPartidaPreviewSourceSet(contract,ownBaseSpec.kind,ownBaseS",
            "previousText": "contract=JSON.parse(read('.github/workspace-acceptance-contract.json')),historical=structuredClone(contract.participantPreanalysisCurrentRevision.nativeSourceFiles),current=participantPreanalysisNativeSourceClosure(f.context.readSource),rawBefore=Buffer.from(f.evidence.get(f.proof.rawNative.path)),referenceBefore=structuredClone(f.proof.rawNative),proofBefore=JSON.stringify(f.proof);\n const outer=contract[PLAN_PARTIDA_PREVIEW_CURRENT_SECTION].sourceSetDeltas.find(row=>row.family===f.context.spec.kind),budget=contract[PLAN_BUDGET_CURRENT_SECTION].sourceSetDeltas.find(row=>row.family===f.context.spec.kind),beforeBudgetFullCi=restorePlanBudgetSourceSet(contract,f.context.spec.kind,f.context.spec.sourceFiles),historicalFullCi=restorePlanPartidaPreviewSourceSet(contract,f.context.spec.kind,f.context.s"
          },
          {
            "currentOffsetCharacters": 22830,
            "currentText": "ownBaseSpec.sourceFiles.length,budget.currentCount);assert.equal(sha(JSON.stringify(ownBaseSpec.sourceFiles)),budget.currentPathsSha256);assert.deepEqual(ownBaseSpec.sourceFiles,[...beforeBudgetFullCi,...budget.additions].sort());assert.deepEqual(f.context.spec.sourceFiles,[...ownBaseSpec.sourceFiles,'src/app/(identity)/cuenta/kyc-camera-session.mjs'",
            "previousText": "f.context.spec.sourceFiles.length,budget.currentCount);assert.equal(sha(JSON.stringify(f.context.spec.sourceFiles)),budget.currentPathsSha256);assert.deepEqual(f.context.spec.sourceFiles,[...beforeBudgetFullCi,...budget.additions"
          },
          {
            "currentOffsetCharacters": 23931,
            "currentText": "f.context.spec.sourceFiles.length",
            "previousText": "budget.currentCount"
          }
        ]
      },
      {
        "path": "tests/production-whatsapp-field-continuity-current-ci-lineage.test.mjs",
        "status": "MODIFIED",
        "previousSha256": "a0e817f4f0ea3bae2a8042447a38ad099fb448a9ec8d34c0fd8e0b754685a497",
        "currentSha256": "205759c15cd2925f027743fd1539c3989b27d6521b6294cbf99f2278dea842d1",
        "previousBytes": 18272,
        "currentBytes": 18732,
        "inverseHunks": [
          {
            "currentOffsetCharacters": 15,
            "currentText": "OwnRuntimeDiagnosticPreviousContract,planBudgetCurrentSourcePin,restore",
            "previousText": ""
          },
          {
            "currentOffsetCharacters": 5083,
            "currentText": "ownBase=restoreOwnRuntimeDiagnosticPreviousContract(actual,read),contract=restorePlanBudgetPreviousContract(ownBase),previous=restoreMaterialReviewPreviousContract(contract),revision=previous[section];assert.deepEqual(composeWhatsappFieldContinuityContract(revision),previous);\n assert.equal(verifyPlanBudgetCurrentSources(actual,read).nativeOrBrowserAcceptance,false);const budget=actual.planBudgetCurrentRevision;assert.deepEqual(actual.blocks,[...contract.blocks,budget.ownership.block]);assert.deepEqual(actual.extension.proofs.at(-1),planBudgetCompiledProof(actual));const inheritedProofs=ownBase.extension.proofs.slice(0,-1).map(spec=>({...spec,sourceFiles:restorePlanBudgetSourceSet(ownBase,spec.kind,spec.sourceFiles)}));assert.deepEqual(inheritedProofs,contract.extension.proofs);for(const index of [19,20]){const live=actual.extension.proofs[index],prior=ownBase.extension.proofs[index];assert.equal(live.producerSha256,planBudgetCurrentSourcePin(actual,{path:live.producer,sha256:prior.producerSha256}));assert.equal(sha(read(live.producer).toString().replaceAll('\\r\\n','\\n')),live.producerSha256);}",
            "previousText": "contract=restorePlanBudgetPreviousContract(actual),previous=restoreMaterialReviewPreviousContract(contract),revision=previous[section];assert.deepEqual(composeWhatsappFieldContinuityContract(revision),previous);\n assert.equal(verifyPlanBudgetCurrentSources(actual,read).nativeOrBrowserAcceptance,false);const budget=actual.planBudgetCurrentRevision;assert.deepEqual(actual.blocks,[...contract.blocks,budget.ownership.block]);assert.deepEqual(actual.extension.proofs.at(-1),planBudgetCompiledProof(actual));const inheritedProofs=actual.extension.proofs.slice(0,-1).map(spec=>({...spec,sourceFiles:restorePlanBudgetSourceSet(actual,spec.kind,spec.sourceFiles)}));assert.deepEqual(inheritedProofs,contract.extension.proofs);"
          }
        ]
      }
    ],
    "retainedDependencies": [
      {
        "path": "src/app/(identity)/cuenta/kyc-camera-session.mjs",
        "sha256": "e84404979093aaad5179cf47433b3930ddc71e7677fe36db6018fcd49bf8e5c4",
        "bytes": 4136,
        "previousMetadataSha256": null,
        "metadataPins": []
      },
      {
        "path": "src/app/(identity)/cuenta/kyc-photo-preparation.js",
        "sha256": "d88c55b9fb97b6b1abb5ecb02cf66b9d8e016821525f1b6a3cc2a381e641c4e5",
        "bytes": 12504,
        "previousMetadataSha256": "88137686826cc411d6fcc103b0085390c0cc16f69572cf45c2385bcde69f943d",
        "metadataPins": [
          "794999ccbafafb029c85a94f946eaa6f3e126a8642db47f1df9f1f0ddee1ce3d",
          "88137686826cc411d6fcc103b0085390c0cc16f69572cf45c2385bcde69f943d"
        ]
      },
      {
        "path": "src/app/(identity)/cuenta/participant-kyc-capture.js",
        "sha256": "556109c32d2f85be4b043513362d682ed7e14811a21a6f08200ac65c53af5d48",
        "bytes": 4864,
        "previousMetadataSha256": "83ee427bbbecbf74aee901fd77c6981232a2cd07e235180566938c2c0201647d",
        "metadataPins": [
          "83ee427bbbecbf74aee901fd77c6981232a2cd07e235180566938c2c0201647d"
        ]
      },
      {
        "path": "src/app/(identity)/cuenta/participant-panel.js",
        "sha256": "1ec30c252d7f0fa8d65905f66eeca76da1644778b9ad710da5487ab667759c82",
        "bytes": 106608,
        "previousMetadataSha256": "a9d5934c7bda61c49362ac53cfb339a5d66497566f71415ecc4621686ce17519",
        "metadataPins": [
          "4e10ff5f05942b9704f247e13972968cc2a441b6ba09bca277694e85a94cd56e",
          "a9d5934c7bda61c49362ac53cfb339a5d66497566f71415ecc4621686ce17519",
          "d16ee3ba394be011c5d338599d01653eec7d462705a2414821e02db3b44e38aa"
        ]
      },
      {
        "path": "src/app/(identity)/cuenta/participant-panel.module.css",
        "sha256": "31ef143f21af5f6ed0aba4f11bf1cf79549ae97c462ed0bef2daaf3e67635250",
        "bytes": 6728,
        "previousMetadataSha256": "c1626d1a678f1060b1ccb9df106f32b041da2c3b2bd92ede3e65537aaf794c02",
        "metadataPins": [
          "3f8f1ff1a2a95dc0288e8b9877f1260753944f8a7fa075a96baf8b5a1e92a1fa",
          "c1626d1a678f1060b1ccb9df106f32b041da2c3b2bd92ede3e65537aaf794c02"
        ]
      },
      {
        "path": "src/app/(identity)/cuenta/workspace-client.js",
        "sha256": "f9acac2e8589afce076c51e07ef2bd4c3a67360faa9970b2cbbd447502c98bc0",
        "bytes": 75429,
        "previousMetadataSha256": "2fe5a56a7caf7d46f11e4292d2e145e3e72072198a09f9951ace42c2613e8db9",
        "metadataPins": [
          "2fe5a56a7caf7d46f11e4292d2e145e3e72072198a09f9951ace42c2613e8db9",
          "4143cf960157d8bd5f642842ee1672a3555c0e415c3dc4579763e2e8eabf84fb",
          "4f3ccde7f433c98e63f0ada92cd1346f0757bea06ea8bf93abf9ac0ff62b79f8",
          "75ae3226996571c43e5a03f47df2241dc28425a00b804f8eb86600b0ea528858",
          "7f9612e2f92d582b1318c39d542060a9ab3d41df72e20511d659235601f10cb8",
          "943f71658a65f113b98ba4e900be95e1020858ba4d85a4431f1a51926ef597fa",
          "e53ad474a3677243fbcaff6ce526c0983514d42e78c6daf60e73ba06d6f63bec"
        ]
      }
    ],
    "metadataInverse": [
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/0/currentFiles",
        "before": [
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
        "after": [
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
          "src/app/(identity)/cuenta/kyc-camera-session.mjs",
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
          "src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs",
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
        ]
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/0/currentManifest",
        "before": [
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
            "sha256": "b439d95c9e48f4b0ef83bd6ca93efac56dc059a8b50b508475d9d5e29af4b6dc"
          },
          {
            "path": "src/app/(identity)/cuenta/company-subscription-panel.module.css",
            "sha256": "678a18a7ad87f8312a7ad9e8267709297653e7572ea4b537ac42b6959b3a523a"
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
            "sha256": "197fa68dacf6ad8adee77f55370363e1bdba63f442d7a7196c96ae95b8829fe7"
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
            "sha256": "18f3616144c03aacf9c9859ae210150d92f6838de7332cee2550fa5fe91603fb"
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
            "sha256": "2fe5a56a7caf7d46f11e4292d2e145e3e72072198a09f9951ace42c2613e8db9"
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
            "sha256": "456e78d9e5c729182e65cd30141af37a5a6571d05261896ab5e19e39c4951c1b"
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
            "sha256": "339fee2591a341bbb7839a19d55a5c298c728ef1de38a2efc3680999f4636db4"
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
            "sha256": "d3dffce08238141f672a8af0c1b956da15809e18608084b9bdf57d50ae166ceb"
          },
          {
            "path": "src/lib/field-operations-policy.mjs",
            "sha256": "bb33655b622a081de656f24c2e369fe7a2e05a0a0a9da7ffe455c2f39fd8fbd5"
          },
          {
            "path": "src/lib/field-operations-store.mjs",
            "sha256": "8f54edfb613fcf90f099015d42c89e993e5d3ca74f5bd11e9743830324547604"
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
        ],
        "after": [
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
            "sha256": "b439d95c9e48f4b0ef83bd6ca93efac56dc059a8b50b508475d9d5e29af4b6dc"
          },
          {
            "path": "src/app/(identity)/cuenta/company-subscription-panel.module.css",
            "sha256": "678a18a7ad87f8312a7ad9e8267709297653e7572ea4b537ac42b6959b3a523a"
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
            "sha256": "197fa68dacf6ad8adee77f55370363e1bdba63f442d7a7196c96ae95b8829fe7"
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
            "sha256": "18f3616144c03aacf9c9859ae210150d92f6838de7332cee2550fa5fe91603fb"
          },
          {
            "path": "src/app/(identity)/cuenta/kyc-camera-session.mjs",
            "sha256": "e84404979093aaad5179cf47433b3930ddc71e7677fe36db6018fcd49bf8e5c4"
          },
          {
            "path": "src/app/(identity)/cuenta/kyc-photo-preparation.js",
            "sha256": "d88c55b9fb97b6b1abb5ecb02cf66b9d8e016821525f1b6a3cc2a381e641c4e5"
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
            "sha256": "6682c17bdb11ea4269540e3a4f14546e013d72869ba19c79a41312cbc65419bf"
          },
          {
            "path": "src/app/(identity)/cuenta/own-company-number-view.mjs",
            "sha256": "6940f11e30d2958d7f6771463ce28ca83c0e2d2f41e81aa220c8efe669580300"
          },
          {
            "path": "src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs",
            "sha256": "a2b5b4fe2499168ee8afe10cc3aa767f56757b376531ab63e4c557b5ed26ea52"
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
            "sha256": "556109c32d2f85be4b043513362d682ed7e14811a21a6f08200ac65c53af5d48"
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
            "sha256": "1ec30c252d7f0fa8d65905f66eeca76da1644778b9ad710da5487ab667759c82"
          },
          {
            "path": "src/app/(identity)/cuenta/participant-panel.module.css",
            "sha256": "31ef143f21af5f6ed0aba4f11bf1cf79549ae97c462ed0bef2daaf3e67635250"
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
            "sha256": "f9acac2e8589afce076c51e07ef2bd4c3a67360faa9970b2cbbd447502c98bc0"
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
            "sha256": "456e78d9e5c729182e65cd30141af37a5a6571d05261896ab5e19e39c4951c1b"
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
            "sha256": "339fee2591a341bbb7839a19d55a5c298c728ef1de38a2efc3680999f4636db4"
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
            "sha256": "d3dffce08238141f672a8af0c1b956da15809e18608084b9bdf57d50ae166ceb"
          },
          {
            "path": "src/lib/field-operations-policy.mjs",
            "sha256": "bb33655b622a081de656f24c2e369fe7a2e05a0a0a9da7ffe455c2f39fd8fbd5"
          },
          {
            "path": "src/lib/field-operations-store.mjs",
            "sha256": "8f54edfb613fcf90f099015d42c89e993e5d3ca74f5bd11e9743830324547604"
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
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/1/currentManifest/0/sha256",
        "before": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449",
        "after": "efc8bb1f69a79a087c7e374e6028bc944707393d91ec19d0f548592d489dc71a"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/1/currentManifest/1/sha256",
        "before": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d",
        "after": "4a97436407ad4f19ef95fb382780e70c16e725bd67075a6eeadbaf6a245d6394"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/1/currentManifest/35/sha256",
        "before": "2fe5a56a7caf7d46f11e4292d2e145e3e72072198a09f9951ace42c2613e8db9",
        "after": "f9acac2e8589afce076c51e07ef2bd4c3a67360faa9970b2cbbd447502c98bc0"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/3/currentManifest/0/sha256",
        "before": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449",
        "after": "efc8bb1f69a79a087c7e374e6028bc944707393d91ec19d0f548592d489dc71a"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/3/currentManifest/1/sha256",
        "before": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d",
        "after": "4a97436407ad4f19ef95fb382780e70c16e725bd67075a6eeadbaf6a245d6394"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/4/currentFiles",
        "before": [
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
        "after": [
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
          "src/app/(identity)/cuenta/kyc-camera-session.mjs",
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
          "src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs",
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
        ]
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/4/currentManifest",
        "before": [
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
            "sha256": "ae44e43ec0202bffc3c729219fe9fdb6066363a970279f62cc4438d5d715ead5"
          },
          {
            "path": "scripts/lib/integrated-identity-current-ci-lineage.mjs",
            "sha256": "aaf23ee0e97231520f29669136d969ffc513bd6b52067df751d3dc6cf9c86bb8"
          },
          {
            "path": "scripts/lib/material-review-current-ci-lineage.mjs",
            "sha256": "9155e03f6c6831e8122263b73c16a724645fc5cd3ebcfdd950c0413543c12a64"
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
            "sha256": "57864fdf5e3ca44dbcb02c98b06f645300527b8d1b1b689928f7f8aa53e476db"
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
            "sha256": "b439d95c9e48f4b0ef83bd6ca93efac56dc059a8b50b508475d9d5e29af4b6dc"
          },
          {
            "path": "src/app/(identity)/cuenta/company-subscription-panel.module.css",
            "sha256": "678a18a7ad87f8312a7ad9e8267709297653e7572ea4b537ac42b6959b3a523a"
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
            "sha256": "197fa68dacf6ad8adee77f55370363e1bdba63f442d7a7196c96ae95b8829fe7"
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
            "sha256": "18f3616144c03aacf9c9859ae210150d92f6838de7332cee2550fa5fe91603fb"
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
            "sha256": "2fe5a56a7caf7d46f11e4292d2e145e3e72072198a09f9951ace42c2613e8db9"
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
            "sha256": "456e78d9e5c729182e65cd30141af37a5a6571d05261896ab5e19e39c4951c1b"
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
            "sha256": "339fee2591a341bbb7839a19d55a5c298c728ef1de38a2efc3680999f4636db4"
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
        ],
        "after": [
          {
            "path": "package-lock.json",
            "sha256": "efc8bb1f69a79a087c7e374e6028bc944707393d91ec19d0f548592d489dc71a"
          },
          {
            "path": "package.json",
            "sha256": "4a97436407ad4f19ef95fb382780e70c16e725bd67075a6eeadbaf6a245d6394"
          },
          {
            "path": "scripts/lib/home-decisions-current-ci-lineage.mjs",
            "sha256": "ae44e43ec0202bffc3c729219fe9fdb6066363a970279f62cc4438d5d715ead5"
          },
          {
            "path": "scripts/lib/integrated-identity-current-ci-lineage.mjs",
            "sha256": "aaf23ee0e97231520f29669136d969ffc513bd6b52067df751d3dc6cf9c86bb8"
          },
          {
            "path": "scripts/lib/material-review-current-ci-lineage.mjs",
            "sha256": "9155e03f6c6831e8122263b73c16a724645fc5cd3ebcfdd950c0413543c12a64"
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
            "sha256": "30dc60ecb4f6aee0044a27d787508d47fa748febad177743c7ca585cd0a231d2"
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
            "sha256": "6ced258e2d012c26481f8f63e8d8bfbfc6011afd6a456f7d463b8aec94393621"
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
            "sha256": "b439d95c9e48f4b0ef83bd6ca93efac56dc059a8b50b508475d9d5e29af4b6dc"
          },
          {
            "path": "src/app/(identity)/cuenta/company-subscription-panel.module.css",
            "sha256": "678a18a7ad87f8312a7ad9e8267709297653e7572ea4b537ac42b6959b3a523a"
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
            "sha256": "197fa68dacf6ad8adee77f55370363e1bdba63f442d7a7196c96ae95b8829fe7"
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
            "sha256": "18f3616144c03aacf9c9859ae210150d92f6838de7332cee2550fa5fe91603fb"
          },
          {
            "path": "src/app/(identity)/cuenta/invitation-entry.js",
            "sha256": "a6c8a1499bcd170afb52120d56ecbddb1241a34d2aa483528d03f306e2c2a481"
          },
          {
            "path": "src/app/(identity)/cuenta/kyc-camera-session.mjs",
            "sha256": "e84404979093aaad5179cf47433b3930ddc71e7677fe36db6018fcd49bf8e5c4"
          },
          {
            "path": "src/app/(identity)/cuenta/kyc-photo-preparation.js",
            "sha256": "d88c55b9fb97b6b1abb5ecb02cf66b9d8e016821525f1b6a3cc2a381e641c4e5"
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
            "sha256": "6682c17bdb11ea4269540e3a4f14546e013d72869ba19c79a41312cbc65419bf"
          },
          {
            "path": "src/app/(identity)/cuenta/own-company-number-view.mjs",
            "sha256": "6940f11e30d2958d7f6771463ce28ca83c0e2d2f41e81aa220c8efe669580300"
          },
          {
            "path": "src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs",
            "sha256": "a2b5b4fe2499168ee8afe10cc3aa767f56757b376531ab63e4c557b5ed26ea52"
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
            "sha256": "556109c32d2f85be4b043513362d682ed7e14811a21a6f08200ac65c53af5d48"
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
            "sha256": "1ec30c252d7f0fa8d65905f66eeca76da1644778b9ad710da5487ab667759c82"
          },
          {
            "path": "src/app/(identity)/cuenta/participant-panel.module.css",
            "sha256": "31ef143f21af5f6ed0aba4f11bf1cf79549ae97c462ed0bef2daaf3e67635250"
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
            "sha256": "f9acac2e8589afce076c51e07ef2bd4c3a67360faa9970b2cbbd447502c98bc0"
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
            "sha256": "456e78d9e5c729182e65cd30141af37a5a6571d05261896ab5e19e39c4951c1b"
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
            "sha256": "339fee2591a341bbb7839a19d55a5c298c728ef1de38a2efc3680999f4636db4"
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
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/5/currentManifest/0/sha256",
        "before": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449",
        "after": "efc8bb1f69a79a087c7e374e6028bc944707393d91ec19d0f548592d489dc71a"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/5/currentManifest/1/sha256",
        "before": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d",
        "after": "4a97436407ad4f19ef95fb382780e70c16e725bd67075a6eeadbaf6a245d6394"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/5/currentManifest/11/sha256",
        "before": "57864fdf5e3ca44dbcb02c98b06f645300527b8d1b1b689928f7f8aa53e476db",
        "after": "30dc60ecb4f6aee0044a27d787508d47fa748febad177743c7ca585cd0a231d2"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/5/currentManifest/21/sha256",
        "before": "1e366a583be909323327524a8fe04db9eb962724ec5073bdf3eb36140ddcdecc",
        "after": "8839de070fd4629ebf676467232ea89149c328d92db095f6dd185b36090367ee"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/5/currentManifest/74/sha256",
        "before": "a0e817f4f0ea3bae2a8042447a38ad099fb448a9ec8d34c0fd8e0b754685a497",
        "after": "205759c15cd2925f027743fd1539c3989b27d6521b6294cbf99f2278dea842d1"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/6/currentManifest/39/sha256",
        "before": "102ae45ad7d0a1054d2c65cdbfa3a6a96accfcd982bebce8d6c32c7bf24b21a2",
        "after": "93c30d36b4a5f3c9b453e907a4ff189dee73879987eb85952cfd2841c26e4594"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/9/currentManifest/0/sha256",
        "before": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449",
        "after": "efc8bb1f69a79a087c7e374e6028bc944707393d91ec19d0f548592d489dc71a"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/9/currentManifest/1/sha256",
        "before": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d",
        "after": "4a97436407ad4f19ef95fb382780e70c16e725bd67075a6eeadbaf6a245d6394"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/9/currentManifest/41/sha256",
        "before": "102ae45ad7d0a1054d2c65cdbfa3a6a96accfcd982bebce8d6c32c7bf24b21a2",
        "after": "93c30d36b4a5f3c9b453e907a4ff189dee73879987eb85952cfd2841c26e4594"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/11/currentManifest/0/sha256",
        "before": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449",
        "after": "efc8bb1f69a79a087c7e374e6028bc944707393d91ec19d0f548592d489dc71a"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/11/currentManifest/1/sha256",
        "before": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d",
        "after": "4a97436407ad4f19ef95fb382780e70c16e725bd67075a6eeadbaf6a245d6394"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/11/currentManifest/19/sha256",
        "before": "300c5e7e0abe65b97b86a200c6cc72444b9c65ce375d61975c56f5abbc6a453b",
        "after": "26686333bb7d5fcddf40b14f25b8c322e16ddef0d62690b2e6d1d1b4a6de2e72"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/11/currentManifest/48/sha256",
        "before": "102ae45ad7d0a1054d2c65cdbfa3a6a96accfcd982bebce8d6c32c7bf24b21a2",
        "after": "93c30d36b4a5f3c9b453e907a4ff189dee73879987eb85952cfd2841c26e4594"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/11/currentManifest/65/sha256",
        "before": "5bdf8a2c6b1333efe0a12481174e433cd58c9e1583ae0972f4cb090892eaaf84",
        "after": "33ac37426beb73a142804bc6e6c903d0d18527282dfb590bf685b74e20df2bf5"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/12/currentManifest/0/sha256",
        "before": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449",
        "after": "efc8bb1f69a79a087c7e374e6028bc944707393d91ec19d0f548592d489dc71a"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/12/currentManifest/1/sha256",
        "before": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d",
        "after": "4a97436407ad4f19ef95fb382780e70c16e725bd67075a6eeadbaf6a245d6394"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/12/currentManifest/41/sha256",
        "before": "102ae45ad7d0a1054d2c65cdbfa3a6a96accfcd982bebce8d6c32c7bf24b21a2",
        "after": "93c30d36b4a5f3c9b453e907a4ff189dee73879987eb85952cfd2841c26e4594"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/13/currentManifest/0/sha256",
        "before": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449",
        "after": "efc8bb1f69a79a087c7e374e6028bc944707393d91ec19d0f548592d489dc71a"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/13/currentManifest/1/sha256",
        "before": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d",
        "after": "4a97436407ad4f19ef95fb382780e70c16e725bd67075a6eeadbaf6a245d6394"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/13/currentManifest/40/sha256",
        "before": "102ae45ad7d0a1054d2c65cdbfa3a6a96accfcd982bebce8d6c32c7bf24b21a2",
        "after": "93c30d36b4a5f3c9b453e907a4ff189dee73879987eb85952cfd2841c26e4594"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/15/currentManifest/0/sha256",
        "before": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449",
        "after": "efc8bb1f69a79a087c7e374e6028bc944707393d91ec19d0f548592d489dc71a"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/15/currentManifest/1/sha256",
        "before": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d",
        "after": "4a97436407ad4f19ef95fb382780e70c16e725bd67075a6eeadbaf6a245d6394"
      },
      {
        "pointer": "/planBudgetCurrentRevision/sourceFamilies/15/currentManifest/4/sha256",
        "before": "57864fdf5e3ca44dbcb02c98b06f645300527b8d1b1b689928f7f8aa53e476db",
        "after": "30dc60ecb4f6aee0044a27d787508d47fa748febad177743c7ca585cd0a231d2"
      },
      {
        "pointer": "/extension/proofs/3/sourceFiles",
        "before": [
          "src/app/(identity)/cuenta/company-channel-view.mjs",
          "src/app/(identity)/cuenta/employee-intake-continuity.mjs",
          "src/app/(identity)/cuenta/employee-intake-panel.js",
          "src/app/(identity)/cuenta/field-media-preparation.mjs",
          "src/app/(identity)/cuenta/kyc-photo-preparation.js",
          "src/app/(identity)/cuenta/own-company-number-view.mjs",
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
          "src/app/(identity)/cuenta/plan-baseline-view.mjs",
          "src/app/(identity)/cuenta/plan-source-curve.mjs",
          "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "src/app/(identity)/cuenta/private-bank-account-panel.js",
          "src/app/(identity)/cuenta/private-bank-account-panel.module.css",
          "src/app/(identity)/cuenta/site-purchase-view.mjs",
          "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
          "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
          "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
          "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
          "src/app/(identity)/cuenta/workspace-session-request.mjs",
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
          "src/lib/participant-http.mjs",
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
          "tests/fixtures/private-bank-fixture.mjs"
        ],
        "after": [
          "src/app/(identity)/cuenta/company-channel-view.mjs",
          "src/app/(identity)/cuenta/employee-intake-continuity.mjs",
          "src/app/(identity)/cuenta/employee-intake-panel.js",
          "src/app/(identity)/cuenta/field-media-preparation.mjs",
          "src/app/(identity)/cuenta/kyc-camera-session.mjs",
          "src/app/(identity)/cuenta/kyc-photo-preparation.js",
          "src/app/(identity)/cuenta/own-company-number-view.mjs",
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
          "src/app/(identity)/cuenta/plan-baseline-view.mjs",
          "src/app/(identity)/cuenta/plan-source-curve.mjs",
          "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "src/app/(identity)/cuenta/private-bank-account-panel.js",
          "src/app/(identity)/cuenta/private-bank-account-panel.module.css",
          "src/app/(identity)/cuenta/site-purchase-view.mjs",
          "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
          "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
          "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
          "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
          "src/app/(identity)/cuenta/workspace-session-request.mjs",
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
          "src/lib/participant-http.mjs",
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
          "tests/fixtures/private-bank-fixture.mjs"
        ]
      },
      {
        "pointer": "/extension/proofs/13/sourceFiles",
        "before": [
          "scripts/lib/company-subscription-ui-fixture.mjs",
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
          "src/app/(identity)/cuenta/onboarding-guide.js",
          "src/app/(identity)/cuenta/onboarding-guide.module.css",
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
          "src/lib/company-subscription-catalog.mjs",
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
          "src/lib/progress-measurement-quantity.js",
          "src/lib/site-register-policy.mjs",
          "src/lib/task-progress-measurement.js",
          "src/lib/voice-progress-draft.mjs",
          "src/lib/whatsapp/tenant-workspace-policy.js",
          "src/lib/workspace-policy.mjs"
        ],
        "after": [
          "scripts/lib/company-subscription-ui-fixture.mjs",
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
          "src/app/(identity)/cuenta/kyc-camera-session.mjs",
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
          "src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs",
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
          "src/lib/company-subscription-catalog.mjs",
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
          "src/lib/progress-measurement-quantity.js",
          "src/lib/site-register-policy.mjs",
          "src/lib/task-progress-measurement.js",
          "src/lib/voice-progress-draft.mjs",
          "src/lib/whatsapp/tenant-workspace-policy.js",
          "src/lib/workspace-policy.mjs"
        ]
      },
      {
        "pointer": "/extension/proofs/18/sourceFiles",
        "before": [
          ".github/scripts/verify-workspace-ci-parallelization.mjs",
          "api/_biometric_core.py",
          "package-lock.json",
          "package.json",
          "scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs",
          "scripts/lib/disposable-postgres-cleanup.mjs",
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
          "scripts/lib/plan-measurement-consumer-ci-lineage.mjs",
          "scripts/lib/plan-measurement-current-ci-lineage.mjs",
          "scripts/lib/plan-measurement-document-association-ci-lineage.mjs",
          "scripts/lib/plan-partida-preview-current-ci-lineage.mjs",
          "scripts/lib/plan-partida-preview-current-ci-reviewed.mjs",
          "scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs",
          "scripts/lib/worksite-live-hours-current-ci-lineage.mjs",
          "scripts/lib/worksite-live-hours-current-ci-reviewed.mjs",
          "scripts/lib/workspace-continuity-current-ci-lineage.mjs",
          "scripts/verify-company-channel-kyc-postgres.mjs",
          "scripts/verify-company-kyc-outbound-compact-ci.mjs",
          "scripts/verify-company-kyc-outbound-compact-postgres.mjs",
          "scripts/verify-company-onboarding-ui.mjs",
          "scripts/verify-consumption-feedback-ci.mjs",
          "scripts/verify-focused-workspace-ci.mjs",
          "scripts/verify-focused-workspace-ui.mjs",
          "scripts/verify-kyc-reply-feedback-ci.mjs",
          "scripts/verify-mobile-workspace-review-ui.mjs",
          "scripts/verify-onboarding-guide-ui.mjs",
          "scripts/verify-organization-usage-ci.mjs",
          "scripts/verify-participant-kyc-preanalysis-ci.mjs",
          "scripts/verify-participant-kyc-preanalysis-postgres.mjs",
          "scripts/verify-participant-project-navigation-ui.mjs",
          "scripts/verify-plan-measurement-ci.mjs",
          "scripts/verify-task-progress-measurement-ui.mjs",
          "scripts/verify-workspace-identity-only-ui.mjs",
          "scripts/verify-workspace-plan-recovery-ui.mjs",
          "scripts/verify-workspace-reload-ui.mjs",
          "scripts/verify-workspace-ui.mjs",
          "src/app/(identity)/cuenta/company-channel-view.mjs",
          "src/app/(identity)/cuenta/employee-intake-continuity.mjs",
          "src/app/(identity)/cuenta/employee-intake-panel.js",
          "src/app/(identity)/cuenta/field-media-preparation.mjs",
          "src/app/(identity)/cuenta/kyc-photo-preparation.js",
          "src/app/(identity)/cuenta/own-company-number-view.mjs",
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
          "src/app/(identity)/cuenta/plan-baseline-view.mjs",
          "src/app/(identity)/cuenta/plan-source-curve.mjs",
          "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "src/app/(identity)/cuenta/private-bank-account-panel.js",
          "src/app/(identity)/cuenta/private-bank-account-panel.module.css",
          "src/app/(identity)/cuenta/site-purchase-view.mjs",
          "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
          "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
          "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
          "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
          "src/app/(identity)/cuenta/workspace-session-request.mjs",
          "src/app/api/identity/participants/route.js",
          "src/app/api/meta/customer-process/route.js",
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
          "src/lib/meta-app-recovery.mjs",
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
          "src/lib/meta-demo-pilot-policy.mjs",
          "src/lib/meta-demo-pilot-runtime.mjs",
          "src/lib/meta-demo-pilot-store.mjs",
          "src/lib/meta-demo-pilot.mjs",
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
          "src/lib/meta-own-company-policy.mjs",
          "src/lib/meta-plan-import-conversation.mjs",
          "src/lib/meta-plan-import-origin.mjs",
          "src/lib/meta-plan-import-recovery.mjs",
          "src/lib/meta-plan-import-transport.mjs",
          "src/lib/meta-recovery-diagnostics.mjs",
          "src/lib/meta-test-dispatch.mjs",
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
          "src/lib/participant-http.mjs",
          "src/lib/participant-identity-provider.mjs",
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
          "src/lib/participant-runtime.mjs",
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
          "src/lib/production-identity-config.mjs",
          "src/lib/progress-measurement-quantity.js",
          "src/lib/site-register-policy.mjs",
          "src/lib/site-register-store.mjs",
          "src/lib/task-progress-measurement.js",
          "src/lib/verified-session.mjs",
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
          "src/lib/workspace-runtime.mjs",
          "src/lib/workspace-store.mjs",
          "tests/fixtures/integrated-identity-contract-27aa.json",
          "tests/fixtures/integrated-identity-ui-producer-migration-86f2.json",
          "tests/fixtures/participant-preanalysis-memory.mjs",
          "tests/fixtures/plan-measurement-ci-unit.mjs",
          "tests/fixtures/plan-measurement-contract-a203.json",
          "tests/fixtures/whatsapp-field-continuity-contract-052.json",
          "tests/fixtures/workspace-continuity-contract-d5d.json",
          "tests/production-company-kyc-outbound-compact-ci.test.mjs",
          "tests/production-field-outbound-current-ci-lineage.test.mjs",
          "tests/production-focused-workspace-ci.test.mjs",
          "tests/production-focused-workspace-ui.test.mjs",
          "tests/production-integrated-identity-current-ci-lineage.test.mjs",
          "tests/production-integrated-identity-ui-producer-migration.test.mjs",
          "tests/production-kyc-reply-feedback-ci.test.mjs",
          "tests/production-kyc-reply-feedback-current-lineage.test.mjs",
          "tests/production-material-consumption-feedback-ci.test.mjs",
          "tests/production-meta-customer-composition.test.mjs",
          "tests/production-ooxml-accounting-current-ci-lineage.test.mjs",
          "tests/production-organization-usage-ci.test.mjs",
          "tests/production-participant-kyc-preanalysis-view.test.mjs",
          "tests/production-participant-kyc-preanalysis.test.mjs",
          "tests/production-participant-preanalysis-current-ci-lineage.test.mjs",
          "tests/production-plan-import-link-ui.test.mjs",
          "tests/production-plan-measurement-ci.test.mjs",
          "tests/production-plan-measurement-consumer-ci-lineage.test.mjs",
          "tests/production-plan-measurement-current-ci-lineage.test.mjs",
          "tests/production-whatsapp-feedback-workspace-ci.test.mjs",
          "tests/production-workspace-tools-navigation.test.mjs"
        ],
        "after": [
          ".github/scripts/verify-workspace-ci-parallelization.mjs",
          "api/_biometric_core.py",
          "package-lock.json",
          "package.json",
          "scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs",
          "scripts/lib/disposable-postgres-cleanup.mjs",
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
          "scripts/lib/plan-measurement-consumer-ci-lineage.mjs",
          "scripts/lib/plan-measurement-current-ci-lineage.mjs",
          "scripts/lib/plan-measurement-document-association-ci-lineage.mjs",
          "scripts/lib/plan-partida-preview-current-ci-lineage.mjs",
          "scripts/lib/plan-partida-preview-current-ci-reviewed.mjs",
          "scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs",
          "scripts/lib/worksite-live-hours-current-ci-lineage.mjs",
          "scripts/lib/worksite-live-hours-current-ci-reviewed.mjs",
          "scripts/lib/workspace-continuity-current-ci-lineage.mjs",
          "scripts/verify-company-channel-kyc-postgres.mjs",
          "scripts/verify-company-kyc-outbound-compact-ci.mjs",
          "scripts/verify-company-kyc-outbound-compact-postgres.mjs",
          "scripts/verify-company-onboarding-ui.mjs",
          "scripts/verify-consumption-feedback-ci.mjs",
          "scripts/verify-focused-workspace-ci.mjs",
          "scripts/verify-focused-workspace-ui.mjs",
          "scripts/verify-kyc-reply-feedback-ci.mjs",
          "scripts/verify-mobile-workspace-review-ui.mjs",
          "scripts/verify-onboarding-guide-ui.mjs",
          "scripts/verify-organization-usage-ci.mjs",
          "scripts/verify-participant-kyc-preanalysis-ci.mjs",
          "scripts/verify-participant-kyc-preanalysis-postgres.mjs",
          "scripts/verify-participant-project-navigation-ui.mjs",
          "scripts/verify-plan-measurement-ci.mjs",
          "scripts/verify-task-progress-measurement-ui.mjs",
          "scripts/verify-workspace-identity-only-ui.mjs",
          "scripts/verify-workspace-plan-recovery-ui.mjs",
          "scripts/verify-workspace-reload-ui.mjs",
          "scripts/verify-workspace-ui.mjs",
          "src/app/(identity)/cuenta/company-channel-view.mjs",
          "src/app/(identity)/cuenta/employee-intake-continuity.mjs",
          "src/app/(identity)/cuenta/employee-intake-panel.js",
          "src/app/(identity)/cuenta/field-media-preparation.mjs",
          "src/app/(identity)/cuenta/kyc-camera-session.mjs",
          "src/app/(identity)/cuenta/kyc-photo-preparation.js",
          "src/app/(identity)/cuenta/own-company-number-view.mjs",
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
          "src/app/(identity)/cuenta/plan-baseline-view.mjs",
          "src/app/(identity)/cuenta/plan-source-curve.mjs",
          "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "src/app/(identity)/cuenta/private-bank-account-panel.js",
          "src/app/(identity)/cuenta/private-bank-account-panel.module.css",
          "src/app/(identity)/cuenta/site-purchase-view.mjs",
          "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
          "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
          "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
          "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
          "src/app/(identity)/cuenta/workspace-session-request.mjs",
          "src/app/api/identity/participants/route.js",
          "src/app/api/meta/customer-process/route.js",
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
          "src/lib/meta-app-recovery.mjs",
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
          "src/lib/meta-demo-pilot-policy.mjs",
          "src/lib/meta-demo-pilot-runtime.mjs",
          "src/lib/meta-demo-pilot-store.mjs",
          "src/lib/meta-demo-pilot.mjs",
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
          "src/lib/meta-own-company-policy.mjs",
          "src/lib/meta-plan-import-conversation.mjs",
          "src/lib/meta-plan-import-origin.mjs",
          "src/lib/meta-plan-import-recovery.mjs",
          "src/lib/meta-plan-import-transport.mjs",
          "src/lib/meta-recovery-diagnostics.mjs",
          "src/lib/meta-test-dispatch.mjs",
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
          "src/lib/participant-http.mjs",
          "src/lib/participant-identity-provider.mjs",
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
          "src/lib/participant-runtime.mjs",
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
          "src/lib/production-identity-config.mjs",
          "src/lib/progress-measurement-quantity.js",
          "src/lib/site-register-policy.mjs",
          "src/lib/site-register-store.mjs",
          "src/lib/task-progress-measurement.js",
          "src/lib/verified-session.mjs",
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
          "src/lib/workspace-runtime.mjs",
          "src/lib/workspace-store.mjs",
          "tests/fixtures/integrated-identity-contract-27aa.json",
          "tests/fixtures/integrated-identity-ui-producer-migration-86f2.json",
          "tests/fixtures/participant-preanalysis-memory.mjs",
          "tests/fixtures/plan-measurement-ci-unit.mjs",
          "tests/fixtures/plan-measurement-contract-a203.json",
          "tests/fixtures/whatsapp-field-continuity-contract-052.json",
          "tests/fixtures/workspace-continuity-contract-d5d.json",
          "tests/production-company-kyc-outbound-compact-ci.test.mjs",
          "tests/production-field-outbound-current-ci-lineage.test.mjs",
          "tests/production-focused-workspace-ci.test.mjs",
          "tests/production-focused-workspace-ui.test.mjs",
          "tests/production-integrated-identity-current-ci-lineage.test.mjs",
          "tests/production-integrated-identity-ui-producer-migration.test.mjs",
          "tests/production-kyc-reply-feedback-ci.test.mjs",
          "tests/production-kyc-reply-feedback-current-lineage.test.mjs",
          "tests/production-material-consumption-feedback-ci.test.mjs",
          "tests/production-meta-customer-composition.test.mjs",
          "tests/production-ooxml-accounting-current-ci-lineage.test.mjs",
          "tests/production-organization-usage-ci.test.mjs",
          "tests/production-participant-kyc-preanalysis-view.test.mjs",
          "tests/production-participant-kyc-preanalysis.test.mjs",
          "tests/production-participant-preanalysis-current-ci-lineage.test.mjs",
          "tests/production-plan-import-link-ui.test.mjs",
          "tests/production-plan-measurement-ci.test.mjs",
          "tests/production-plan-measurement-consumer-ci-lineage.test.mjs",
          "tests/production-plan-measurement-current-ci-lineage.test.mjs",
          "tests/production-whatsapp-feedback-workspace-ci.test.mjs",
          "tests/production-workspace-tools-navigation.test.mjs"
        ]
      },
      {
        "pointer": "/extension/proofs/19/sourceFiles",
        "before": [
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
        "after": [
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
          "src/app/(identity)/cuenta/kyc-camera-session.mjs",
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
          "src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs",
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
        ]
      },
      {
        "pointer": "/extension/proofs/19/producerSha256",
        "before": "532e37e994540a6fecd8c70d067730cddec4a66403686113cef4087828c2229c",
        "after": "6ced258e2d012c26481f8f63e8d8bfbfc6011afd6a456f7d463b8aec94393621"
      },
      {
        "pointer": "/extension/proofs/20/producerSha256",
        "before": "1e366a583be909323327524a8fe04db9eb962724ec5073bdf3eb36140ddcdecc",
        "after": "8839de070fd4629ebf676467232ea89149c328d92db095f6dd185b36090367ee"
      },
      {
        "pointer": "/evidenceProducers/72/producerSha256",
        "before": "532e37e994540a6fecd8c70d067730cddec4a66403686113cef4087828c2229c",
        "after": "6ced258e2d012c26481f8f63e8d8bfbfc6011afd6a456f7d463b8aec94393621"
      },
      {
        "pointer": "/evidenceProducers/73/producerSha256",
        "before": "1e366a583be909323327524a8fe04db9eb962724ec5073bdf3eb36140ddcdecc",
        "after": "8839de070fd4629ebf676467232ea89149c328d92db095f6dd185b36090367ee"
      },
      {
        "pointer": "/packageLockSha256",
        "before": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449",
        "after": "efc8bb1f69a79a087c7e374e6028bc944707393d91ec19d0f548592d489dc71a"
      }
    ]
  }
});
