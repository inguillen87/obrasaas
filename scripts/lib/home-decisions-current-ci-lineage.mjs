import {createHash} from 'node:crypto';
import {parse} from '@babel/parser';

export const HOME_DECISIONS_CURRENT_SECTION='homeDecisionsCurrentRevision';
export const HOME_DECISIONS_CURRENT_HELPER='scripts/lib/home-decisions-current-ci-lineage.mjs';
export const HOME_DECISIONS_CURRENT_TEST='tests/production-home-decisions-current-ci-lineage.test.mjs';
export const HOME_DECISIONS_CURRENT_REVISION=Object.freeze({
  "version": 1,
  "status": "REVIEWED_HOME_DECISIONS_READS_AND_NAVIGATION",
  "predecessorCommit": "2b98984628761783ba7bd7e6543dbe1d76c0203c",
  "previousContractSha256": "fe3fbd513518951d4e9625f0c76d89bd5c178919d923d3a385f32ab7c787590e",
  "reviewedSourceChanges": [
    {
      "path": "scripts/verify-field-operations-ui.mjs",
      "previousSha256": "114baf2bcf9a8c683d18c3ea4080c2b11ad175b9d7c294bbeb76bd364105f9e6",
      "currentSha256": "b7c7fc5c94f97b621e36ef1e45ee0cd828fd67e8530fb14f4662ed0184d0e4d4"
    },
    {
      "path": "scripts/verify-focused-workspace-ui.mjs",
      "previousSha256": "00278d6fe4980a84a41508412340a0acde44bc4790945753cd7b557d80fb545e",
      "currentSha256": "fde529288d806f0aed540f155f4b7058485b7c6bcdfe8edddc607eb89b868cac"
    },
    {
      "path": "scripts/verify-material-inventory-postgres.mjs",
      "previousSha256": "727d5d4841f787dc92d4b08b8d316a673c3e119dfe5ce70cbb332a80945ead47",
      "currentSha256": "56c2c4751825349b126d26bc48fcce0557f11b779f94b3fad45985f34bbc409b"
    },
    {
      "path": "src/app/(identity)/cuenta/field-operations-panel.js",
      "previousSha256": "c49b5639442fcc1f334fb2684c9921e18c3930448f74653a6cae4262ae12e081",
      "currentSha256": "270ac8e6f6d1a42d7dacdc64931b5ff5de75cea0e409b1815928858782d20d6c"
    },
    {
      "path": "src/app/(identity)/cuenta/field-review-page-view.mjs",
      "previousSha256": "415918bcc8305b485fc98b5ed1bf691a221c9b09aa290622032e35303f988b19",
      "currentSha256": "18f3616144c03aacf9c9859ae210150d92f6838de7332cee2550fa5fe91603fb"
    },
    {
      "path": "src/app/(identity)/cuenta/workspace-client.js",
      "previousSha256": "943f71658a65f113b98ba4e900be95e1020858ba4d85a4431f1a51926ef597fa",
      "currentSha256": "7f9612e2f92d582b1318c39d542060a9ab3d41df72e20511d659235601f10cb8"
    },
    {
      "path": "src/app/(identity)/cuenta/workspace-overview.js",
      "previousSha256": "eae7613778d7f12c0851e6412a1c5806890ef9b6f5e64d73c1647d8902e704f8",
      "currentSha256": "1efd9a741ddd4e38492c38f62d95104a0a98c715a962df44aab0d1f793031b00"
    },
    {
      "path": "src/app/(identity)/cuenta/workspace.module.css",
      "previousSha256": "8870cb4905c5d2f44751a5c502bed1001f6a3627c2cd6ec34b331c28b193c787",
      "currentSha256": "339fee2591a341bbb7839a19d55a5c298c728ef1de38a2efc3680999f4636db4"
    },
    {
      "path": "src/lib/operations-status.mjs",
      "previousSha256": "11a821f858e24a81208d1a3196703f6b4c29330e931ee3ae5998fd0d49dbf5bd",
      "currentSha256": "cdee54c539106c384a92c70c730c91cd3058e872d5d855c57150b8ad246e666a"
    },
    {
      "path": "tests/production-field-video-audio-processing.test.mjs",
      "previousSha256": "0cd556481ec95fd7bb32f0aeee203d81b69f3fb45683b882b9b9b53fa72eedb9",
      "currentSha256": "dc660bdfefa04a9958e60ed3e04a0062ec2a87928d6dd48bfda1f562fe4acabd"
    },
    {
      "path": "tests/production-focused-workspace-ci.test.mjs",
      "previousSha256": "fa7cce48eb957bc56a7465fa6b61cf05a4083caae6d7bd40e431c12feef3cb79",
      "currentSha256": "0319f722df958e9928d9ec8d27819f7e482cf66bc3c565c6743ced30f016921e"
    },
    {
      "path": "tests/production-focused-workspace-continuity-ui.test.mjs",
      "previousSha256": "e839e4aee67df7c2558a6fdfced25310c4e9cab0d95ae1b605b0158d9004e37b",
      "currentSha256": "d545f4361f513e3b1c7a3b3ca9db5bd6d12be0ae74b3df327880fb9954649a8d"
    },
    {
      "path": "tests/production-focused-workspace-task-pagination.test.mjs",
      "previousSha256": "9821b448d023f626372453485fb9a2cf81c1f0d75d918c8e32bec916f989be25",
      "currentSha256": "058eb4f1ed8812e2b4d8341ea55bff8a98c22292153482260fdb9f0773398b35"
    },
    {
      "path": "tests/production-integrated-identity-current-ci-lineage.test.mjs",
      "previousSha256": "287964d63ceb3ac3c96cf6a7cc3321575ea7e0fa95827e1440955b67fdc5b1a5",
      "currentSha256": "7563982646aebf713696686499ae5fdde8cc007fec3b28f448e728c7e7cda68d"
    },
    {
      "path": "tests/production-material-review-current-ci-lineage.test.mjs",
      "previousSha256": "38012a323a305bd8e41dcc04bc698b50dcac04110cec2cb7db93c8fa0f1e7ffa",
      "currentSha256": "d4ff4dd321b7e7499cd2aed817abc0f5aab47b94e38d9d88c72d694d1768b0a1"
    },
    {
      "path": "tests/production-meta-existing-api-plan-current-ci-lineage.test.mjs",
      "previousSha256": "ab3984d2393131261baa298b9408394b695cbca9f8e06d54ddac563c20c41587",
      "currentSha256": "b321b7dfb5c82333883f2008b5dfe9e00b6d8aba31c920bd3484e397bf5dd1ed"
    },
    {
      "path": "tests/production-operations-status.test.mjs",
      "previousSha256": "3b94ae535c03942e29bc09db7e9f9d074e18930a38fe6c56bfdb36c4c68d6a4e",
      "currentSha256": "4185d2b01cd1a142b846ee05067e38ae4dad60f90ae7dc0288f19cdddd77adf9"
    },
    {
      "path": "tests/production-whatsapp-field-continuity-current-ci-lineage.test.mjs",
      "previousSha256": "63d8b5b1c3e8f3f38add5c66b0901ea4477a7e7c9eb394ed6f02a4a4ee2b8acb",
      "currentSha256": "d55968747a2bfc23f02de49d0418374665e2db7e156cfa0356c21145cc9c83b4"
    },
    {
      "path": "tests/production-workspace-continuity-current-ci-lineage.test.mjs",
      "previousSha256": "43f8948d518c55da5bef74e0c48b596847426cc973cc44dc96bdb0f777f43f3b",
      "currentSha256": "991b357dbba1a4c69060bad450c536a6314ab99948c9baff5da5405fd3511c6c"
    }
  ],
  "validationDeltas": [
    {
      "path": "scripts/lib/material-review-current-ci-lineage.mjs",
      "previousSha256": "a20327c78db66275e998937e599178722f29790f0238e7323221ad765bc3e28d",
      "currentSha256": "083738bfeebc34437708790608b126f7d81926fe1982aaf9e76aedbca783f211"
    },
    {
      "path": "scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs",
      "previousSha256": "52211c8e3e3a676e09b8f477692e849367e8e282e71c88539e2e5fe87a282022",
      "currentSha256": "f7e4779963eed7cd0442f7e4a9ebc56a75543fae1e69f9ad6214e18af1b04bfc"
    },
    {
      "path": "scripts/verify-focused-workspace-ci.mjs",
      "previousSha256": "a4eb59cb781eeb9578e46ffcdec21833cce1ba79eb9f99e3543fda799dfc62f4",
      "currentSha256": "48650c362bfc0b9d8fd49976fbc4ae1a124776167c60ba08f60d2b163ee94e24"
    }
  ],
  "proofSourceDeltas": [
    {
      "id": "participant-kyc-preanalysis-postgres",
      "family": "PG_PARTICIPANT_KYC_PREANALYSIS",
      "previousCount": 237,
      "previousPathsSha256": "80777809d188cac7e1c58c08186bff41eb023fb85cafa27775e16231cc4bede4",
      "currentCount": 238,
      "currentPathsSha256": "cd841d37ce905f066258d3f0c76ac1fd28b96e4c49b123663dc41164403bb0b5",
      "additions": [
        "scripts/lib/home-decisions-current-ci-lineage.mjs"
      ],
      "inheritedSets": [
        {
          "count": 200,
          "pathsSha256": "64012c5b7be1d291bff1f861c7d81cf8480e2492e4fdfd101cafff42485d47d1"
        },
        {
          "count": 229,
          "pathsSha256": "935ce4042c36639e55046301a2c72c93200cdc72f8a8d989ca7a8b403cffddee"
        },
        {
          "count": 231,
          "pathsSha256": "31655b2096aac71b78ab7471af7c538c75019a153beb40393d012a823b9f1835"
        },
        {
          "count": 233,
          "pathsSha256": "9844cc0014597fcedda24f4ac25cf6a7c1a7c3bfdb8a37f9510e76388aa5642f"
        },
        {
          "count": 235,
          "pathsSha256": "71c09c50336b9e87cd1da0de7618209175846b70f6d5d890432d274ca039aed2"
        },
        {
          "count": 236,
          "pathsSha256": "3bb953705acc389789b7c2cf465ebe39dbd89be683c36f29ce64d5356d946aa0"
        },
        {
          "count": 237,
          "pathsSha256": "80777809d188cac7e1c58c08186bff41eb023fb85cafa27775e16231cc4bede4"
        }
      ]
    },
    {
      "id": "focused-workspace-ui",
      "family": "UI_FOCUSED_WORKSPACE",
      "previousCount": 183,
      "previousPathsSha256": "5e672ad9f2fef063d1472fe2ce49516ba708fd25a2b602f001a10e60cfb589e6",
      "currentCount": 184,
      "currentPathsSha256": "2fc2eaf4f05e8f58b4fe703709c5b421a2760fe331e64ebf680d566aece4d6e8",
      "additions": [
        "scripts/lib/home-decisions-current-ci-lineage.mjs"
      ],
      "inheritedSets": [
        {
          "count": 168,
          "pathsSha256": "712011a79baf15b67f34d8dc521920795346612e347ac4b0e5eed3a47b48a770"
        },
        {
          "count": 170,
          "pathsSha256": "aea278136cfc58258f3f92e081cbdf9066c4770a48371eaa079b5ce5a4a77a88"
        },
        {
          "count": 174,
          "pathsSha256": "e0d4ef354cade414d88d8d0348ed818d9bd0447b26a3bba38d8a7c8cbebf51d4"
        },
        {
          "count": 180,
          "pathsSha256": "5163b57706633f09f8f66345b4694326b36d208b3f21206191cd388d23505961"
        },
        {
          "count": 181,
          "pathsSha256": "5bfe95440c584af2c30487188ca644dbd05434f9eb15ee60a98dc71a3cdf5578"
        },
        {
          "count": 183,
          "pathsSha256": "5e672ad9f2fef063d1472fe2ce49516ba708fd25a2b602f001a10e60cfb589e6"
        }
      ]
    },
    {
      "id": "field-task-pagination-ui",
      "family": "UI_FIELD_TASK_PAGINATION",
      "previousCount": 64,
      "previousPathsSha256": "ebf85a9a6d749b9d6f8dcdcb69963c41d49e2289db6bc5d7e793279227105fb2",
      "currentCount": 65,
      "currentPathsSha256": "37c4005666f2a3f09a857c3153dd49c2dd49e0f76337b135e293cabb2d34850b",
      "additions": [
        "scripts/lib/home-decisions-current-ci-lineage.mjs"
      ],
      "inheritedSets": [
        {
          "count": 62,
          "pathsSha256": "6fb541e46adac1ed66a262398b26b8af73ce5de2fd267b584a6bf1308f8f9fd7"
        },
        {
          "count": 63,
          "pathsSha256": "718c812e30061467b52a99c9d7383463b02bc2ae4c69eafb5015c8c396aff7ca"
        },
        {
          "count": 64,
          "pathsSha256": "ebf85a9a6d749b9d6f8dcdcb69963c41d49e2289db6bc5d7e793279227105fb2"
        }
      ]
    }
  ],
  "proofProducerDeltas": [
    {
      "id": "focused-workspace-ui",
      "producer": "scripts/verify-focused-workspace-ci.mjs",
      "path": ".vercel/private/focused-workspace-ui-evidence/current-ci.json",
      "previousProducerSha256": "a4eb59cb781eeb9578e46ffcdec21833cce1ba79eb9f99e3543fda799dfc62f4",
      "currentProducerSha256": "48650c362bfc0b9d8fd49976fbc4ae1a124776167c60ba08f60d2b163ee94e24"
    }
  ],
  "operationsProjection": {
    "previousAstSha256": "362cc52cc78fcf54d547432add5d9f4d12f505ffa9dbeb8f7af4df6ec9ce2c63",
    "removedNodeSha256": [
      "2c91da11d8494d40c99c1fd0ff671f5e8baa0cfcee0705441a64b3b112656c5e",
      "08ded08bea6e243137741ec54e04e705061ae3c2e4d39226dc6081d1662c56a2"
    ],
    "replacements": [
      {
        "currentNodeSha256": "cd58c467a3935abda3d1d18f5c848b43bf718bb7bba6835c75fa590669b588aa",
        "previousNode": {
          "type": "IfStatement",
          "test": {
            "type": "LogicalExpression",
            "left": {
              "type": "BinaryExpression",
              "left": {
                "type": "MemberExpression",
                "object": {
                  "type": "Identifier",
                  "name": "params"
                },
                "computed": false,
                "property": {
                  "type": "Identifier",
                  "name": "size"
                }
              },
              "operator": "!==",
              "right": {
                "type": "NumericLiteral",
                "value": 2
              }
            },
            "operator": "||",
            "right": {
              "type": "CallExpression",
              "callee": {
                "type": "MemberExpression",
                "object": {
                  "type": "ArrayExpression",
                  "elements": [
                    {
                      "type": "SpreadElement",
                      "argument": {
                        "type": "CallExpression",
                        "callee": {
                          "type": "MemberExpression",
                          "object": {
                            "type": "Identifier",
                            "name": "params"
                          },
                          "computed": false,
                          "property": {
                            "type": "Identifier",
                            "name": "keys"
                          }
                        },
                        "arguments": []
                      }
                    }
                  ]
                },
                "computed": false,
                "property": {
                  "type": "Identifier",
                  "name": "some"
                }
              },
              "arguments": [
                {
                  "type": "ArrowFunctionExpression",
                  "id": null,
                  "generator": false,
                  "async": false,
                  "params": [
                    {
                      "type": "Identifier",
                      "name": "k"
                    }
                  ],
                  "body": {
                    "type": "LogicalExpression",
                    "left": {
                      "type": "UnaryExpression",
                      "operator": "!",
                      "prefix": true,
                      "argument": {
                        "type": "CallExpression",
                        "callee": {
                          "type": "MemberExpression",
                          "object": {
                            "type": "ArrayExpression",
                            "elements": [
                              {
                                "type": "StringLiteral",
                                "value": "projectId"
                              },
                              {
                                "type": "StringLiteral",
                                "value": "scope"
                              }
                            ]
                          },
                          "computed": false,
                          "property": {
                            "type": "Identifier",
                            "name": "includes"
                          }
                        },
                        "arguments": [
                          {
                            "type": "Identifier",
                            "name": "k"
                          }
                        ]
                      }
                    },
                    "operator": "||",
                    "right": {
                      "type": "BinaryExpression",
                      "left": {
                        "type": "MemberExpression",
                        "object": {
                          "type": "CallExpression",
                          "callee": {
                            "type": "MemberExpression",
                            "object": {
                              "type": "Identifier",
                              "name": "params"
                            },
                            "computed": false,
                            "property": {
                              "type": "Identifier",
                              "name": "getAll"
                            }
                          },
                          "arguments": [
                            {
                              "type": "Identifier",
                              "name": "k"
                            }
                          ]
                        },
                        "computed": false,
                        "property": {
                          "type": "Identifier",
                          "name": "length"
                        }
                      },
                      "operator": "!==",
                      "right": {
                        "type": "NumericLiteral",
                        "value": 1
                      }
                    }
                  }
                }
              ]
            }
          },
          "consequent": {
            "type": "ThrowStatement",
            "argument": {
              "type": "NewExpression",
              "callee": {
                "type": "Identifier",
                "name": "WorkspaceError"
              },
              "arguments": [
                {
                  "type": "StringLiteral",
                  "value": "OPERATIONS_STATUS_QUERY_INVALID"
                }
              ]
            }
          },
          "alternate": null
        }
      },
      {
        "currentNodeSha256": "adbccf0e85de8a2c943181194e4938e37c91f23450e4ada19d031be2b862d840",
        "previousNode": {
          "type": "VariableDeclaration",
          "declarations": [
            {
              "type": "VariableDeclarator",
              "id": {
                "type": "Identifier",
                "name": "context"
              },
              "init": {
                "type": "ObjectExpression",
                "properties": [
                  {
                    "type": "ObjectProperty",
                    "method": false,
                    "key": {
                      "type": "Identifier",
                      "name": "projectId"
                    },
                    "computed": false,
                    "shorthand": false,
                    "value": {
                      "type": "CallExpression",
                      "callee": {
                        "type": "MemberExpression",
                        "object": {
                          "type": "Identifier",
                          "name": "params"
                        },
                        "computed": false,
                        "property": {
                          "type": "Identifier",
                          "name": "get"
                        }
                      },
                      "arguments": [
                        {
                          "type": "StringLiteral",
                          "value": "projectId"
                        }
                      ]
                    }
                  },
                  {
                    "type": "ObjectProperty",
                    "method": false,
                    "key": {
                      "type": "Identifier",
                      "name": "scope"
                    },
                    "computed": false,
                    "shorthand": false,
                    "value": {
                      "type": "CallExpression",
                      "callee": {
                        "type": "MemberExpression",
                        "object": {
                          "type": "Identifier",
                          "name": "params"
                        },
                        "computed": false,
                        "property": {
                          "type": "Identifier",
                          "name": "get"
                        }
                      },
                      "arguments": [
                        {
                          "type": "StringLiteral",
                          "value": "scope"
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ],
          "kind": "const"
        }
      }
    ]
  },
  "focusedUi": {
    "producer": "scripts/verify-focused-workspace-ui.mjs",
    "previousCheckNames": [
      "hidden-panel-headings-absent-from-accessibility-tree-390",
      "one-mounted-visible-overview-and-hidden-panels-390",
      "identity-deep-link-history-no-mutation-390",
      "legacy-plan-import-fragment-opens-schedule-390",
      "nonadmin-cannot-see-billing-or-integration-navigation-390",
      "schedule-draft-survives-section-navigation-without-POST-390",
      "no-project-hint-keeps-an-explicit-usable-project-picker-390",
      "company-plan-and-recovery-without-selected-project-company-without-selection-390",
      "company-plan-and-recovery-without-selected-project-empty-company-390",
      "three-step-synthetic-identity-explicit-consents-and-unknown-receipt-survive-navigation-390",
      "hidden-panel-headings-absent-from-accessibility-tree-1440",
      "one-mounted-visible-overview-and-hidden-panels-1440",
      "identity-deep-link-history-no-mutation-1440",
      "legacy-plan-import-fragment-opens-schedule-1440",
      "nonadmin-cannot-see-billing-or-integration-navigation-1440",
      "schedule-draft-survives-section-navigation-without-POST-1440",
      "no-project-hint-keeps-an-explicit-usable-project-picker-1440",
      "company-plan-and-recovery-without-selected-project-company-without-selection-1440",
      "company-plan-and-recovery-without-selected-project-empty-company-1440",
      "three-step-synthetic-identity-explicit-consents-and-unknown-receipt-survive-navigation-1440",
      "fresh-list-project-preserves-section-no-POST-320",
      "fresh-list-project-preserves-section-no-POST-390",
      "fresh-list-project-preserves-section-no-POST-1440",
      "refresh-does-not-restore-old-view-list-role-390",
      "refresh-does-not-restore-old-view-list-scope-390",
      "refresh-does-not-restore-old-view-list-missing-390",
      "refresh-does-not-restore-old-view-list-401-390",
      "refresh-does-not-restore-old-view-list-403-390",
      "refresh-does-not-restore-old-view-list-500-390",
      "refresh-does-not-restore-old-view-project-401-390",
      "refresh-does-not-restore-old-view-project-403-390",
      "refresh-does-not-restore-old-view-project-500-390",
      "refresh-does-not-restore-old-view-project-scope-390",
      "refresh-does-not-restore-old-view-project-id-390",
      "refresh-does-not-restore-old-view-project-null-390",
      "refresh-truncated-list-promotes-fresh-canonical-project-390",
      "refresh-truncated-list-denial-keeps-old-view-closed-390",
      "refresh-truncated-list-inactive-project-keeps-old-view-closed-390",
      "refresh-private-KYC-denial-keeps-only-private-presentation-390",
      "refresh-office-selection-uses-fresh-listed-context-without-operational-GET-390",
      "refresh-late-list-cannot-reenter-rotated-session-390",
      "refresh-late-project-cannot-reenter-unmounted-workspace-390",
      "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-320",
      "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-390",
      "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-1440",
      "account-task-pages-draft-100-200-205-single-GET-field-320",
      "account-task-pages-draft-100-200-205-single-GET-inventory-320",
      "account-task-pages-draft-100-200-205-single-GET-field-390",
      "account-task-pages-draft-100-200-205-single-GET-inventory-390",
      "account-task-pages-draft-100-200-205-single-GET-field-1440",
      "account-task-pages-draft-100-200-205-single-GET-inventory-1440",
      "account-task-pages-503-retry-field-390",
      "account-task-pages-403-clear-field-390",
      "account-task-pages-busy-uncertain-and-late-page-field-390",
      "account-task-pages-503-retry-inventory-390",
      "account-task-pages-403-clear-inventory-390",
      "account-task-pages-busy-uncertain-and-late-page-inventory-390",
      "account-task-pages-404-revoked-clear-field-390",
      "account-task-pages-404-revoked-clear-inventory-390"
    ],
    "addedCheckNames": [
      "home-decisions-auto-scoped-read-and-queues-320",
      "home-decisions-auto-scoped-read-and-queues-390",
      "home-decisions-auto-scoped-read-and-queues-768",
      "home-decisions-auto-scoped-read-and-queues-1440",
      "home-decisions-director-390",
      "home-decisions-no-management-read-WORKER-390",
      "home-decisions-no-management-read-AUDITOR-390",
      "home-decisions-only-when-home-active-390",
      "home-decisions-no-false-zero-denied-390",
      "home-decisions-no-false-zero-500-390",
      "home-decisions-no-false-zero-missing-390",
      "home-decisions-no-false-zero-foreign-scope-390",
      "home-decisions-no-false-zero-foreign-project-390",
      "home-decisions-no-false-zero-negative-390",
      "home-decisions-no-false-zero-invalid-date-390",
      "home-decisions-no-false-zero-capability-390",
      "home-decisions-explicit-retry-390",
      "home-decisions-late-response-does-not-reenter-hidden-home-390"
    ],
    "currentCheckNames": [
      "hidden-panel-headings-absent-from-accessibility-tree-390",
      "one-mounted-visible-overview-and-hidden-panels-390",
      "identity-deep-link-history-no-mutation-390",
      "legacy-plan-import-fragment-opens-schedule-390",
      "nonadmin-cannot-see-billing-or-integration-navigation-390",
      "schedule-draft-survives-section-navigation-without-POST-390",
      "no-project-hint-keeps-an-explicit-usable-project-picker-390",
      "company-plan-and-recovery-without-selected-project-company-without-selection-390",
      "company-plan-and-recovery-without-selected-project-empty-company-390",
      "three-step-synthetic-identity-explicit-consents-and-unknown-receipt-survive-navigation-390",
      "hidden-panel-headings-absent-from-accessibility-tree-1440",
      "one-mounted-visible-overview-and-hidden-panels-1440",
      "identity-deep-link-history-no-mutation-1440",
      "legacy-plan-import-fragment-opens-schedule-1440",
      "nonadmin-cannot-see-billing-or-integration-navigation-1440",
      "schedule-draft-survives-section-navigation-without-POST-1440",
      "no-project-hint-keeps-an-explicit-usable-project-picker-1440",
      "company-plan-and-recovery-without-selected-project-company-without-selection-1440",
      "company-plan-and-recovery-without-selected-project-empty-company-1440",
      "three-step-synthetic-identity-explicit-consents-and-unknown-receipt-survive-navigation-1440",
      "fresh-list-project-preserves-section-no-POST-320",
      "fresh-list-project-preserves-section-no-POST-390",
      "fresh-list-project-preserves-section-no-POST-1440",
      "refresh-does-not-restore-old-view-list-role-390",
      "refresh-does-not-restore-old-view-list-scope-390",
      "refresh-does-not-restore-old-view-list-missing-390",
      "refresh-does-not-restore-old-view-list-401-390",
      "refresh-does-not-restore-old-view-list-403-390",
      "refresh-does-not-restore-old-view-list-500-390",
      "refresh-does-not-restore-old-view-project-401-390",
      "refresh-does-not-restore-old-view-project-403-390",
      "refresh-does-not-restore-old-view-project-500-390",
      "refresh-does-not-restore-old-view-project-scope-390",
      "refresh-does-not-restore-old-view-project-id-390",
      "refresh-does-not-restore-old-view-project-null-390",
      "refresh-truncated-list-promotes-fresh-canonical-project-390",
      "refresh-truncated-list-denial-keeps-old-view-closed-390",
      "refresh-truncated-list-inactive-project-keeps-old-view-closed-390",
      "refresh-private-KYC-denial-keeps-only-private-presentation-390",
      "refresh-office-selection-uses-fresh-listed-context-without-operational-GET-390",
      "refresh-late-list-cannot-reenter-rotated-session-390",
      "refresh-late-project-cannot-reenter-unmounted-workspace-390",
      "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-320",
      "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-390",
      "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-1440",
      "account-task-pages-draft-100-200-205-single-GET-field-320",
      "account-task-pages-draft-100-200-205-single-GET-inventory-320",
      "account-task-pages-draft-100-200-205-single-GET-field-390",
      "account-task-pages-draft-100-200-205-single-GET-inventory-390",
      "account-task-pages-draft-100-200-205-single-GET-field-1440",
      "account-task-pages-draft-100-200-205-single-GET-inventory-1440",
      "account-task-pages-503-retry-field-390",
      "account-task-pages-403-clear-field-390",
      "account-task-pages-busy-uncertain-and-late-page-field-390",
      "account-task-pages-503-retry-inventory-390",
      "account-task-pages-403-clear-inventory-390",
      "account-task-pages-busy-uncertain-and-late-page-inventory-390",
      "account-task-pages-404-revoked-clear-field-390",
      "account-task-pages-404-revoked-clear-inventory-390",
      "home-decisions-auto-scoped-read-and-queues-320",
      "home-decisions-auto-scoped-read-and-queues-390",
      "home-decisions-auto-scoped-read-and-queues-768",
      "home-decisions-auto-scoped-read-and-queues-1440",
      "home-decisions-director-390",
      "home-decisions-no-management-read-WORKER-390",
      "home-decisions-no-management-read-AUDITOR-390",
      "home-decisions-only-when-home-active-390",
      "home-decisions-no-false-zero-denied-390",
      "home-decisions-no-false-zero-500-390",
      "home-decisions-no-false-zero-missing-390",
      "home-decisions-no-false-zero-foreign-scope-390",
      "home-decisions-no-false-zero-foreign-project-390",
      "home-decisions-no-false-zero-negative-390",
      "home-decisions-no-false-zero-invalid-date-390",
      "home-decisions-no-false-zero-capability-390",
      "home-decisions-explicit-retry-390",
      "home-decisions-late-response-does-not-reenter-hidden-home-390"
    ],
    "widths": [
      320,
      390,
      768,
      1440
    ],
    "previousRequestCount": 406,
    "previousRequestMatrixSha256": "1625cbbd3a610f3a53433bfd17ccb4d9fc1ceff4920487b52f8c78f0fc8a932d",
    "currentRequestCount": 541,
    "currentRequestMatrixSha256": "a2d7127552fbf4ec48dbbe9bd88d0c1ef9204f5a3c72f55181e506439b0a2e8b",
    "requestProjectionFieldsOmitted": [
      "operationId",
      "recoveryReferenceSha256",
      "syntheticImageSha256"
    ],
    "previousRequestIndices": [
      0,
      1,
      2,
      4,
      5,
      6,
      7,
      8,
      9,
      11,
      12,
      13,
      14,
      15,
      16,
      18,
      19,
      20,
      21,
      22,
      23,
      24,
      25,
      26,
      27,
      28,
      29,
      30,
      31,
      32,
      33,
      34,
      35,
      36,
      37,
      38,
      39,
      40,
      41,
      42,
      43,
      44,
      45,
      46,
      47,
      48,
      49,
      50,
      51,
      52,
      53,
      54,
      55,
      56,
      57,
      58,
      59,
      60,
      61,
      63,
      64,
      65,
      66,
      67,
      68,
      69,
      70,
      71,
      72,
      73,
      74,
      75,
      76,
      77,
      78,
      79,
      80,
      81,
      82,
      83,
      84,
      85,
      86,
      87,
      88,
      89,
      90,
      91,
      92,
      93,
      94,
      95,
      96,
      97,
      98,
      99,
      100,
      101,
      102,
      103,
      104,
      105,
      106,
      107,
      108,
      109,
      110,
      111,
      112,
      113,
      114,
      115,
      116,
      117,
      118,
      119,
      120,
      121,
      122,
      123,
      124,
      125,
      126,
      127,
      128,
      129,
      130,
      131,
      132,
      133,
      134,
      135,
      136,
      137,
      138,
      139,
      140,
      141,
      142,
      143,
      144,
      145,
      146,
      147,
      148,
      149,
      150,
      151,
      152,
      153,
      154,
      155,
      156,
      157,
      158,
      159,
      160,
      161,
      162,
      163,
      164,
      165,
      166,
      167,
      168,
      169,
      170,
      171,
      172,
      173,
      174,
      175,
      176,
      177,
      178,
      179,
      180,
      181,
      182,
      183,
      184,
      185,
      186,
      187,
      188,
      189,
      190,
      191,
      192,
      193,
      194,
      195,
      196,
      197,
      198,
      199,
      200,
      201,
      202,
      203,
      204,
      205,
      206,
      207,
      208,
      209,
      210,
      211,
      212,
      213,
      214,
      215,
      216,
      217,
      218,
      219,
      220,
      221,
      222,
      223,
      224,
      225,
      226,
      227,
      228,
      229,
      230,
      231,
      232,
      233,
      234,
      235,
      236,
      237,
      238,
      239,
      240,
      241,
      242,
      243,
      244,
      245,
      246,
      247,
      248,
      249,
      250,
      251,
      252,
      253,
      254,
      255,
      256,
      257,
      258,
      259,
      260,
      261,
      262,
      263,
      264,
      265,
      266,
      267,
      268,
      269,
      270,
      271,
      272,
      273,
      274,
      275,
      276,
      277,
      278,
      279,
      280,
      281,
      282,
      283,
      284,
      285,
      286,
      287,
      288,
      289,
      290,
      291,
      292,
      293,
      294,
      295,
      296,
      297,
      298,
      299,
      300,
      301,
      302,
      303,
      304,
      305,
      306,
      307,
      308,
      309,
      310,
      311,
      312,
      313,
      314,
      315,
      316,
      317,
      318,
      319,
      320,
      321,
      322,
      323,
      324,
      325,
      326,
      327,
      328,
      329,
      330,
      331,
      332,
      333,
      334,
      335,
      336,
      337,
      338,
      339,
      340,
      341,
      342,
      343,
      344,
      345,
      346,
      347,
      348,
      349,
      350,
      351,
      352,
      353,
      354,
      355,
      356,
      357,
      358,
      359,
      360,
      361,
      362,
      363,
      364,
      365,
      366,
      367,
      368,
      369,
      370,
      371,
      372,
      373,
      374,
      375,
      376,
      377,
      378,
      379,
      380,
      381,
      382,
      383,
      384,
      385,
      386,
      387,
      388,
      389,
      390,
      391,
      392,
      393,
      394,
      395,
      396,
      397,
      398,
      399,
      400,
      401,
      402,
      403,
      404,
      405,
      406,
      407,
      408,
      409
    ],
    "addedRequestFacts": [
      {
        "index": 3,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "navigation",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 10,
        "request": {
          "width": 1440,
          "role": "ADMIN",
          "mode": "navigation",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 17,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "navigation",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 62,
        "request": {
          "width": 1440,
          "role": "ADMIN",
          "mode": "navigation",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 410,
        "request": {
          "width": 320,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 411,
        "request": {
          "width": 320,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 412,
        "request": {
          "width": 320,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/company-subscription",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 413,
        "request": {
          "width": 320,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 414,
        "request": {
          "width": 320,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/project-preparation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 415,
        "request": {
          "width": 320,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/project-creation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 416,
        "request": {
          "width": 320,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/office-review",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 417,
        "request": {
          "width": 320,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 418,
        "request": {
          "width": 320,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/field-operations",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 419,
        "request": {
          "width": 320,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 420,
        "request": {
          "width": 320,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/field-operations",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 421,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 422,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 423,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/company-subscription",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 424,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 425,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/project-preparation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 426,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/project-creation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 427,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/office-review",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 428,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 429,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/field-operations",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 430,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 431,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/field-operations",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 432,
        "request": {
          "width": 768,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 433,
        "request": {
          "width": 768,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 434,
        "request": {
          "width": 768,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/company-subscription",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 435,
        "request": {
          "width": 768,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 436,
        "request": {
          "width": 768,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/project-preparation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 437,
        "request": {
          "width": 768,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/project-creation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 438,
        "request": {
          "width": 768,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/office-review",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 439,
        "request": {
          "width": 768,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 440,
        "request": {
          "width": 768,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/field-operations",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 441,
        "request": {
          "width": 768,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 442,
        "request": {
          "width": 768,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/field-operations",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 443,
        "request": {
          "width": 1440,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 444,
        "request": {
          "width": 1440,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 445,
        "request": {
          "width": 1440,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/company-subscription",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 446,
        "request": {
          "width": 1440,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 447,
        "request": {
          "width": 1440,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/project-preparation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 448,
        "request": {
          "width": 1440,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/project-creation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 449,
        "request": {
          "width": 1440,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/office-review",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 450,
        "request": {
          "width": 1440,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 451,
        "request": {
          "width": 1440,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/field-operations",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 452,
        "request": {
          "width": 1440,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 453,
        "request": {
          "width": 1440,
          "role": "ADMIN",
          "mode": "home-normal",
          "path": "/api/identity/field-operations",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 454,
        "request": {
          "width": 390,
          "role": "DIRECTOR",
          "mode": "home-director",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 455,
        "request": {
          "width": 390,
          "role": "DIRECTOR",
          "mode": "home-director",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 456,
        "request": {
          "width": 390,
          "role": "DIRECTOR",
          "mode": "home-director",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 457,
        "request": {
          "width": 390,
          "role": "DIRECTOR",
          "mode": "home-director",
          "path": "/api/identity/project-preparation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 458,
        "request": {
          "width": 390,
          "role": "WORKER",
          "mode": "home-no-manager",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 459,
        "request": {
          "width": 390,
          "role": "WORKER",
          "mode": "home-no-manager",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 460,
        "request": {
          "width": 390,
          "role": "AUDITOR",
          "mode": "home-no-manager",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 461,
        "request": {
          "width": 390,
          "role": "AUDITOR",
          "mode": "home-no-manager",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 462,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-inactive",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 463,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-inactive",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 464,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-inactive",
          "path": "/api/identity/company-subscription",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 465,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-inactive",
          "path": "/api/identity/project-preparation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 466,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-inactive",
          "path": "/api/identity/project-creation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 467,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-inactive",
          "path": "/api/identity/office-review",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 468,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-inactive",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 469,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-denied",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 470,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-denied",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 471,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-denied",
          "path": "/api/identity/company-subscription",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 472,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-denied",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 473,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-denied",
          "path": "/api/identity/project-preparation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 474,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-denied",
          "path": "/api/identity/project-creation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 475,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-denied",
          "path": "/api/identity/office-review",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 476,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-500",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 477,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-500",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 478,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-500",
          "path": "/api/identity/company-subscription",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 479,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-500",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 480,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-500",
          "path": "/api/identity/project-preparation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 481,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-500",
          "path": "/api/identity/project-creation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 482,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-500",
          "path": "/api/identity/office-review",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 483,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-missing",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 484,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-missing",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 485,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-missing",
          "path": "/api/identity/company-subscription",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 486,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-missing",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 487,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-missing",
          "path": "/api/identity/project-preparation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 488,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-missing",
          "path": "/api/identity/project-creation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 489,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-missing",
          "path": "/api/identity/office-review",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 490,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-foreign-scope",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 491,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-foreign-scope",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 492,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-foreign-scope",
          "path": "/api/identity/company-subscription",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 493,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-foreign-scope",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 494,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-foreign-scope",
          "path": "/api/identity/project-preparation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 495,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-foreign-scope",
          "path": "/api/identity/project-creation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 496,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-foreign-scope",
          "path": "/api/identity/office-review",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 497,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-foreign-project",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 498,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-foreign-project",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 499,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-foreign-project",
          "path": "/api/identity/company-subscription",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 500,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-foreign-project",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 501,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-foreign-project",
          "path": "/api/identity/project-preparation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 502,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-foreign-project",
          "path": "/api/identity/project-creation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 503,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-foreign-project",
          "path": "/api/identity/office-review",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 504,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-negative",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 505,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-negative",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 506,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-negative",
          "path": "/api/identity/company-subscription",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 507,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-negative",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 508,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-negative",
          "path": "/api/identity/project-preparation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 509,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-negative",
          "path": "/api/identity/project-creation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 510,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-negative",
          "path": "/api/identity/office-review",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 511,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-invalid-date",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 512,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-invalid-date",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 513,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-invalid-date",
          "path": "/api/identity/company-subscription",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 514,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-invalid-date",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 515,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-invalid-date",
          "path": "/api/identity/project-preparation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 516,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-invalid-date",
          "path": "/api/identity/project-creation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 517,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-invalid-date",
          "path": "/api/identity/office-review",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 518,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-capability",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 519,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-capability",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 520,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-capability",
          "path": "/api/identity/company-subscription",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 521,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-capability",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 522,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-capability",
          "path": "/api/identity/project-preparation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 523,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-capability",
          "path": "/api/identity/project-creation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 524,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-capability",
          "path": "/api/identity/office-review",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 525,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-retry",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 526,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-retry",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 527,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-retry",
          "path": "/api/identity/company-subscription",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 528,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-retry",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 529,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-retry",
          "path": "/api/identity/project-preparation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 530,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-retry",
          "path": "/api/identity/project-creation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 531,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-retry",
          "path": "/api/identity/office-review",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 532,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-retry",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 533,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-late",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 534,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-late",
          "path": "/api/identity/workspace",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 535,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-late",
          "path": "/api/identity/company-subscription",
          "method": "GET",
          "projectId": null
        }
      },
      {
        "index": 536,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-late",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 537,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-late",
          "path": "/api/identity/project-preparation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 538,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-late",
          "path": "/api/identity/project-creation",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 539,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-late",
          "path": "/api/identity/office-review",
          "method": "GET",
          "projectId": "project-a"
        }
      },
      {
        "index": 540,
        "request": {
          "width": 390,
          "role": "ADMIN",
          "mode": "home-late",
          "path": "/api/identity/operations-status",
          "method": "GET",
          "projectId": "project-a"
        }
      }
    ],
    "previousScreenshotNames": [
      "overview-before-checks-390.png",
      "overview-before-checks-1440.png",
      "overview-390.png",
      "identity-deep-390.png",
      "legacy-schedule-390.png",
      "limited-role-390.png",
      "draft-before-390.png",
      "draft-after-390.png",
      "project-picker-before-390.png",
      "project-picker-after-390.png",
      "company-plan-company-without-selection-390.png",
      "company-plan-empty-company-390.png",
      "wizard-front-390.png",
      "wizard-back-390.png",
      "wizard-final-before-390.png",
      "wizard-uncertain-after-390.png",
      "overview-1440.png",
      "identity-deep-1440.png",
      "legacy-schedule-1440.png",
      "limited-role-1440.png",
      "draft-before-1440.png",
      "draft-after-1440.png",
      "project-picker-before-1440.png",
      "project-picker-after-1440.png",
      "company-plan-company-without-selection-1440.png",
      "company-plan-empty-company-1440.png",
      "wizard-front-1440.png",
      "wizard-back-1440.png",
      "wizard-final-before-1440.png",
      "wizard-uncertain-after-1440.png",
      "continuity-restored-320.png",
      "continuity-restored-390.png",
      "continuity-restored-1440.png",
      "continuity-list-role-390.png",
      "continuity-list-scope-390.png",
      "continuity-list-missing-390.png",
      "continuity-list-401-390.png",
      "continuity-list-403-390.png",
      "continuity-list-500-390.png",
      "continuity-project-401-390.png",
      "continuity-project-403-390.png",
      "continuity-project-500-390.png",
      "continuity-project-scope-390.png",
      "continuity-project-id-390.png",
      "continuity-project-null-390.png",
      "continuity-truncated-promoted-390.png",
      "continuity-truncated-denied-390.png",
      "continuity-truncated-inactive-390.png",
      "continuity-private-only-390.png",
      "continuity-office-restored-390.png",
      "continuity-late-list-rejected-390.png",
      "continuity-unmounted-late-project-390.png",
      "bootstrap-ready-compact-320.png",
      "bootstrap-ready-open-320.png",
      "bootstrap-ready-compact-390.png",
      "bootstrap-ready-open-390.png",
      "bootstrap-ready-compact-1440.png",
      "bootstrap-ready-open-1440.png",
      "task-pages-field-205-320.png",
      "task-pages-inventory-205-320.png",
      "task-pages-field-205-390.png",
      "task-pages-inventory-205-390.png",
      "task-pages-field-205-1440.png",
      "task-pages-inventory-205-1440.png",
      "task-pages-field-503-retry-390.png",
      "task-pages-field-403-clear-390.png",
      "task-pages-field-parent-block-390.png",
      "task-pages-inventory-503-retry-390.png",
      "task-pages-inventory-403-clear-390.png",
      "task-pages-inventory-parent-block-390.png",
      "task-pages-field-404-revoked-clear-390.png",
      "task-pages-inventory-404-revoked-clear-390.png"
    ],
    "screenshotNames": [
      "overview-before-checks-390.png",
      "overview-before-checks-1440.png",
      "overview-390.png",
      "identity-deep-390.png",
      "legacy-schedule-390.png",
      "limited-role-390.png",
      "draft-before-390.png",
      "draft-after-390.png",
      "project-picker-before-390.png",
      "project-picker-after-390.png",
      "company-plan-company-without-selection-390.png",
      "company-plan-empty-company-390.png",
      "wizard-front-390.png",
      "wizard-back-390.png",
      "wizard-final-before-390.png",
      "wizard-uncertain-after-390.png",
      "overview-1440.png",
      "identity-deep-1440.png",
      "legacy-schedule-1440.png",
      "limited-role-1440.png",
      "draft-before-1440.png",
      "draft-after-1440.png",
      "project-picker-before-1440.png",
      "project-picker-after-1440.png",
      "company-plan-company-without-selection-1440.png",
      "company-plan-empty-company-1440.png",
      "wizard-front-1440.png",
      "wizard-back-1440.png",
      "wizard-final-before-1440.png",
      "wizard-uncertain-after-1440.png",
      "continuity-restored-320.png",
      "continuity-restored-390.png",
      "continuity-restored-1440.png",
      "continuity-list-role-390.png",
      "continuity-list-scope-390.png",
      "continuity-list-missing-390.png",
      "continuity-list-401-390.png",
      "continuity-list-403-390.png",
      "continuity-list-500-390.png",
      "continuity-project-401-390.png",
      "continuity-project-403-390.png",
      "continuity-project-500-390.png",
      "continuity-project-scope-390.png",
      "continuity-project-id-390.png",
      "continuity-project-null-390.png",
      "continuity-truncated-promoted-390.png",
      "continuity-truncated-denied-390.png",
      "continuity-truncated-inactive-390.png",
      "continuity-private-only-390.png",
      "continuity-office-restored-390.png",
      "continuity-late-list-rejected-390.png",
      "continuity-unmounted-late-project-390.png",
      "bootstrap-ready-compact-320.png",
      "bootstrap-ready-open-320.png",
      "bootstrap-ready-compact-390.png",
      "bootstrap-ready-open-390.png",
      "bootstrap-ready-compact-1440.png",
      "bootstrap-ready-open-1440.png",
      "task-pages-field-205-320.png",
      "task-pages-inventory-205-320.png",
      "task-pages-field-205-390.png",
      "task-pages-inventory-205-390.png",
      "task-pages-field-205-1440.png",
      "task-pages-inventory-205-1440.png",
      "task-pages-field-503-retry-390.png",
      "task-pages-field-403-clear-390.png",
      "task-pages-field-parent-block-390.png",
      "task-pages-inventory-503-retry-390.png",
      "task-pages-inventory-403-clear-390.png",
      "task-pages-inventory-parent-block-390.png",
      "task-pages-field-404-revoked-clear-390.png",
      "task-pages-inventory-404-revoked-clear-390.png",
      "home-pending-decisions-320.png",
      "home-pending-decisions-390.png",
      "home-pending-decisions-768.png",
      "home-pending-decisions-1440.png"
    ]
  },
  "native": {
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
      "native-canonical-rejection-updates-microsecond-revision-while-decided-cursor-remains-usable-for-the-next-pending-page-and-directed-ALL-recovery-keeps-stock-unchanged"
    ],
    "addedCheckNames": [
      "native-home-decisions-read-uses-two-canonical-same-snapshot-aggregates-with-current-progress-material-totals-tenant-role-scope-denials-and-no-business-write"
    ],
    "currentCheckNames": [
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
    "sourceFiles": [
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
    "previousMaterialReviewQueue": {
      "environment": "real-disposable-localhost-postgresql",
      "pendingPerKindBeforeReview": 203,
      "newerClosedPerKind": 151,
      "pendingPages": {
        "consumptions": [
          100,
          100,
          3
        ],
        "adjustments": [
          100,
          100,
          3
        ]
      },
      "anchorProof": [
        {
          "kind": "consumptions",
          "nextPageRows": 100,
          "revisionChanged": true,
          "stockChanged": false
        },
        {
          "kind": "adjustments",
          "nextPageRows": 100,
          "revisionChanged": true,
          "stockChanged": false
        }
      ],
      "readOnlyTransactions": 24,
      "readOnlySetting": "on",
      "isolation": "repeatable read",
      "readOnlyStateUnchanged": true,
      "summaryMatchesUnboundedSameSnapshot": true,
      "rolesDenied": [
        "SITE_MANAGER",
        "AUDITOR"
      ],
      "providerCalls": 0
    },
    "homeDecisions": {
      "projection": "decisions",
      "sqlQueriesPerRead": 2,
      "authorizedReads": [
        {
          "projectId": "p-material-review",
          "role": "ADMIN",
          "queries": 2
        },
        {
          "projectId": "p-material-review",
          "role": "DIRECTOR",
          "queries": 2
        },
        {
          "projectId": "p-b",
          "role": "ADMIN",
          "queries": 2
        }
      ],
      "progressPending": 2,
      "materialPendingPerKind": 202,
      "foreignProgressPending": 1,
      "excludedExpiredClosedProviderAndVersion": true,
      "canonicalReadOnly": true,
      "businessStateUnchanged": true,
      "providerCalls": 0
    }
  },
  "fieldUi": {
    "producer": "scripts/verify-field-operations-ui.mjs",
    "previousCheckNames": [
      "access-load-401-clears-private-state-and-URLs-after-late-GET-320",
      "access-load-403-clears-private-state-and-URLs-after-late-GET-320",
      "access-load-html-401-clears-private-state-and-URLs-after-late-GET-320",
      "access-load-context-clears-private-state-and-URLs-after-late-GET-320",
      "access-post-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-refresh-401-confirmed-receipt-clears-private-state-with-no-new-attempt",
      "access-recovery-file-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-retry-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "qr-download-uses-active-tab-bearer-and-revokes-private-url",
      "private-media-download-active-tab-bearer-exact-bytes-and-url-cleanup",
      "authorized-private-image-readback-and-object-url-cleanup-320",
      "configure-qr-location-private-evidence-review-and-approval-320",
      "proposal-review-initial-participant-get-confirmed-before-reviewer-switch-320",
      "proposal-review-exact-authorized-linked-files-distinct-reviewer-private-readback-320",
      "journey-actions-follow-canonical-sequence-and-recorded-review-pending-ingress-exit-320",
      "attendance-revision-fresh-manual-current-journey-preserves-draft-and-exact-rejection-journal-320",
      "attendance-revision-retry-manual-current-journey-preserves-draft-and-exact-rejection-journal-320",
      "attendance-revision-invalid-manual-current-journey-preserves-draft-and-exact-rejection-journal-320",
      "attendance-revision-gps-stale-manual-current-journey-preserves-draft-and-exact-rejection-journal-320",
      "attendance-gps-cancel-success-local-cancel-protects-draft-callback-and-receipt-320",
      "attendance-gps-cancel-error-local-cancel-protects-draft-callback-and-receipt-320",
      "attendance-gps-retry-local-cancel-protects-draft-callback-and-receipt-320",
      "attendance-gps-draft-cancel-local-cancel-protects-draft-callback-and-receipt-320",
      "attendance-gps-context-local-cancel-protects-draft-callback-and-receipt-320",
      "attendance-gps-uncertain-local-cancel-protects-draft-callback-and-receipt-320",
      "draft-preservation-file-save-retains-draft-with-own-controls-320",
      "draft-preservation-file-cancel-retains-draft-with-own-controls-320",
      "draft-preservation-form-retains-draft-with-own-controls-320",
      "draft-preservation-review-retains-draft-with-own-controls-320",
      "draft-preservation-voice-retains-draft-with-own-controls-320",
      "large-original-preserved-local-photo-prepared-rotated-explicit-save-320",
      "authorized-private-audio-readback-decodes-and-revokes-object-url-320",
      "synthetic-native-audio-record-review-explicit-save-320",
      "authorized-private-video-readback-decodes-and-revokes-object-url-320",
      "synthetic-native-video-record-review-explicit-save-320",
      "own-worker-canonical-incident-and-material-drafts-320",
      "current-QR-reprints-after-reload-by-sector-authenticated-GET-without-POST-320",
      "QR-renewal-explicit-checkbox-and-cancel-never-write-320",
      "nonfirst-sector-edit-preserves-other-sector-ID-and-coordinates-320",
      "sector-bounds-empty-not-zero-integer-radius-consented-GPS-prepares-locally-320",
      "selected-sector-tab-GPS-and-primary-save-hover-text-remain-readable-320",
      "new-sector-appends-with-preserved-existing-sectors-no-GPS-or-token-storage-320",
      "access-load-401-clears-private-state-and-URLs-after-late-GET-390",
      "access-load-403-clears-private-state-and-URLs-after-late-GET-390",
      "access-load-html-401-clears-private-state-and-URLs-after-late-GET-390",
      "access-load-context-clears-private-state-and-URLs-after-late-GET-390",
      "access-post-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-refresh-401-confirmed-receipt-clears-private-state-with-no-new-attempt",
      "access-recovery-file-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-retry-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "qr-download-uses-active-tab-bearer-and-revokes-private-url",
      "private-media-download-active-tab-bearer-exact-bytes-and-url-cleanup",
      "authorized-private-image-readback-and-object-url-cleanup-390",
      "configure-qr-location-private-evidence-review-and-approval-390",
      "proposal-review-initial-participant-get-confirmed-before-reviewer-switch-390",
      "proposal-review-exact-authorized-linked-files-distinct-reviewer-private-readback-390",
      "journey-actions-follow-canonical-sequence-and-recorded-review-pending-ingress-exit-390",
      "attendance-revision-fresh-manual-current-journey-preserves-draft-and-exact-rejection-journal-390",
      "attendance-revision-retry-manual-current-journey-preserves-draft-and-exact-rejection-journal-390",
      "attendance-revision-invalid-manual-current-journey-preserves-draft-and-exact-rejection-journal-390",
      "attendance-revision-gps-stale-manual-current-journey-preserves-draft-and-exact-rejection-journal-390",
      "attendance-gps-cancel-success-local-cancel-protects-draft-callback-and-receipt-390",
      "attendance-gps-cancel-error-local-cancel-protects-draft-callback-and-receipt-390",
      "attendance-gps-retry-local-cancel-protects-draft-callback-and-receipt-390",
      "attendance-gps-draft-cancel-local-cancel-protects-draft-callback-and-receipt-390",
      "attendance-gps-context-local-cancel-protects-draft-callback-and-receipt-390",
      "attendance-gps-uncertain-local-cancel-protects-draft-callback-and-receipt-390",
      "draft-preservation-file-save-retains-draft-with-own-controls-390",
      "draft-preservation-file-cancel-retains-draft-with-own-controls-390",
      "draft-preservation-form-retains-draft-with-own-controls-390",
      "draft-preservation-review-retains-draft-with-own-controls-390",
      "draft-preservation-voice-retains-draft-with-own-controls-390",
      "large-original-preserved-local-photo-prepared-rotated-explicit-save-390",
      "authorized-private-audio-readback-decodes-and-revokes-object-url-390",
      "synthetic-native-audio-record-review-explicit-save-390",
      "authorized-private-video-readback-decodes-and-revokes-object-url-390",
      "synthetic-native-video-record-review-explicit-save-390",
      "own-worker-canonical-incident-and-material-drafts-390",
      "current-QR-reprints-after-reload-by-sector-authenticated-GET-without-POST-390",
      "QR-renewal-explicit-checkbox-and-cancel-never-write-390",
      "nonfirst-sector-edit-preserves-other-sector-ID-and-coordinates-390",
      "sector-bounds-empty-not-zero-integer-radius-consented-GPS-prepares-locally-390",
      "selected-sector-tab-GPS-and-primary-save-hover-text-remain-readable-390",
      "new-sector-appends-with-preserved-existing-sectors-no-GPS-or-token-storage-390",
      "access-load-401-clears-private-state-and-URLs-after-late-GET-768",
      "access-load-403-clears-private-state-and-URLs-after-late-GET-768",
      "access-load-html-401-clears-private-state-and-URLs-after-late-GET-768",
      "access-load-context-clears-private-state-and-URLs-after-late-GET-768",
      "access-post-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-refresh-401-confirmed-receipt-clears-private-state-with-no-new-attempt",
      "access-recovery-file-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-retry-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "qr-download-uses-active-tab-bearer-and-revokes-private-url",
      "private-media-download-active-tab-bearer-exact-bytes-and-url-cleanup",
      "authorized-private-image-readback-and-object-url-cleanup-768",
      "configure-qr-location-private-evidence-review-and-approval-768",
      "proposal-review-initial-participant-get-confirmed-before-reviewer-switch-768",
      "proposal-review-exact-authorized-linked-files-distinct-reviewer-private-readback-768",
      "journey-actions-follow-canonical-sequence-and-recorded-review-pending-ingress-exit-768",
      "attendance-revision-fresh-manual-current-journey-preserves-draft-and-exact-rejection-journal-768",
      "attendance-revision-retry-manual-current-journey-preserves-draft-and-exact-rejection-journal-768",
      "attendance-revision-invalid-manual-current-journey-preserves-draft-and-exact-rejection-journal-768",
      "attendance-revision-gps-stale-manual-current-journey-preserves-draft-and-exact-rejection-journal-768",
      "attendance-gps-cancel-success-local-cancel-protects-draft-callback-and-receipt-768",
      "attendance-gps-cancel-error-local-cancel-protects-draft-callback-and-receipt-768",
      "attendance-gps-retry-local-cancel-protects-draft-callback-and-receipt-768",
      "attendance-gps-draft-cancel-local-cancel-protects-draft-callback-and-receipt-768",
      "attendance-gps-context-local-cancel-protects-draft-callback-and-receipt-768",
      "attendance-gps-uncertain-local-cancel-protects-draft-callback-and-receipt-768",
      "draft-preservation-file-save-retains-draft-with-own-controls-768",
      "draft-preservation-file-cancel-retains-draft-with-own-controls-768",
      "draft-preservation-form-retains-draft-with-own-controls-768",
      "draft-preservation-review-retains-draft-with-own-controls-768",
      "draft-preservation-voice-retains-draft-with-own-controls-768",
      "large-original-preserved-local-photo-prepared-rotated-explicit-save-768",
      "authorized-private-audio-readback-decodes-and-revokes-object-url-768",
      "synthetic-native-audio-record-review-explicit-save-768",
      "authorized-private-video-readback-decodes-and-revokes-object-url-768",
      "synthetic-native-video-record-review-explicit-save-768",
      "own-worker-canonical-incident-and-material-drafts-768",
      "current-QR-reprints-after-reload-by-sector-authenticated-GET-without-POST-768",
      "QR-renewal-explicit-checkbox-and-cancel-never-write-768",
      "nonfirst-sector-edit-preserves-other-sector-ID-and-coordinates-768",
      "sector-bounds-empty-not-zero-integer-radius-consented-GPS-prepares-locally-768",
      "selected-sector-tab-GPS-and-primary-save-hover-text-remain-readable-768",
      "new-sector-appends-with-preserved-existing-sectors-no-GPS-or-token-storage-768",
      "access-load-401-clears-private-state-and-URLs-after-late-GET-1280",
      "access-load-403-clears-private-state-and-URLs-after-late-GET-1280",
      "access-load-html-401-clears-private-state-and-URLs-after-late-GET-1280",
      "access-load-context-clears-private-state-and-URLs-after-late-GET-1280",
      "access-post-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-refresh-401-confirmed-receipt-clears-private-state-with-no-new-attempt",
      "access-recovery-file-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-retry-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "qr-download-uses-active-tab-bearer-and-revokes-private-url",
      "private-media-download-active-tab-bearer-exact-bytes-and-url-cleanup",
      "authorized-private-image-readback-and-object-url-cleanup-1280",
      "configure-qr-location-private-evidence-review-and-approval-1280",
      "proposal-review-initial-participant-get-confirmed-before-reviewer-switch-1280",
      "proposal-review-exact-authorized-linked-files-distinct-reviewer-private-readback-1280",
      "journey-actions-follow-canonical-sequence-and-recorded-review-pending-ingress-exit-1280",
      "attendance-revision-fresh-manual-current-journey-preserves-draft-and-exact-rejection-journal-1280",
      "attendance-revision-retry-manual-current-journey-preserves-draft-and-exact-rejection-journal-1280",
      "attendance-revision-invalid-manual-current-journey-preserves-draft-and-exact-rejection-journal-1280",
      "attendance-revision-gps-stale-manual-current-journey-preserves-draft-and-exact-rejection-journal-1280",
      "attendance-gps-cancel-success-local-cancel-protects-draft-callback-and-receipt-1280",
      "attendance-gps-cancel-error-local-cancel-protects-draft-callback-and-receipt-1280",
      "attendance-gps-retry-local-cancel-protects-draft-callback-and-receipt-1280",
      "attendance-gps-draft-cancel-local-cancel-protects-draft-callback-and-receipt-1280",
      "attendance-gps-context-local-cancel-protects-draft-callback-and-receipt-1280",
      "attendance-gps-uncertain-local-cancel-protects-draft-callback-and-receipt-1280",
      "draft-preservation-file-save-retains-draft-with-own-controls-1280",
      "draft-preservation-file-cancel-retains-draft-with-own-controls-1280",
      "draft-preservation-form-retains-draft-with-own-controls-1280",
      "draft-preservation-review-retains-draft-with-own-controls-1280",
      "draft-preservation-voice-retains-draft-with-own-controls-1280",
      "large-original-preserved-local-photo-prepared-rotated-explicit-save-1280",
      "authorized-private-audio-readback-decodes-and-revokes-object-url-1280",
      "synthetic-native-audio-record-review-explicit-save-1280",
      "authorized-private-video-readback-decodes-and-revokes-object-url-1280",
      "synthetic-native-video-record-review-explicit-save-1280",
      "own-worker-canonical-incident-and-material-drafts-1280",
      "current-QR-reprints-after-reload-by-sector-authenticated-GET-without-POST-1280",
      "QR-renewal-explicit-checkbox-and-cancel-never-write-1280",
      "nonfirst-sector-edit-preserves-other-sector-ID-and-coordinates-1280",
      "sector-bounds-empty-not-zero-integer-radius-consented-GPS-prepares-locally-1280",
      "selected-sector-tab-GPS-and-primary-save-hover-text-remain-readable-1280",
      "new-sector-appends-with-preserved-existing-sectors-no-GPS-or-token-storage-1280",
      "access-camera-context-late-device-callback-cannot-restore-private-draft",
      "access-location-context-late-device-callback-cannot-restore-private-draft",
      "access-load-qr-403-clears-private-state-and-URLs-after-late-GET-390",
      "access-load-project-clears-private-state-and-URLs-after-late-GET-390",
      "access-load-404-clears-private-state-and-URLs-after-late-GET-390",
      "access-load-draft-403-clears-private-state-and-URLs-after-late-GET-390",
      "access-post-context-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-post-process-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "fresh-PROCESS-denial-keeps-reference-through-denied-GET-and-reload-recovers-only-by-GET",
      "access-post-html-401-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-refresh-context-confirmed-receipt-clears-private-state-with-no-new-attempt",
      "access-recovery-html-401-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-recovery-context-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-recovery-malformed-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "validated-PROCESSING-remains-blocked-until-RECORDED-recovery-with-no-extra-POST",
      "access-recovery-processing-expired-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-recovery-processing-bad-date-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "ordinary-500-keeps-local-file-and-draft-with-no-POST",
      "journey-uses-canonical-sequence-over-list-order-and-preserves-revision",
      "journey-chooses-eligible-own-worker-and-filters-ineligible-fiches-without-post",
      "applied-and-rejected-proposals-show-recorded-decision-date-without-expiration",
      "field-draft-locks-project-until-explicit-cancel",
      "qr-download-uses-active-tab-bearer-and-revokes-private-url",
      "field-private-file-draft-locks-project-until-explicit-cancel",
      "expired-proposal-displays-deadline-without-authorizing-or-changing-progress",
      "uncertain-save-recovery-does-not-send-a-second-POST",
      "stale-revision-preserves-the-complete-form",
      "denied-project-never-shows-example-records",
      "explicit-recording-cancel-stops-synthetic-microphone-without-upload",
      "cancel-pending-permission-stops-late-synthetic-stream",
      "permission-denial-preserves-form-and-supports-file-fallback",
      "unsupported-photo-keeps-submit-disabled-with-actionable-message",
      "native-qr-explicit-start-cancel-stops-synthetic-camera",
      "real-local-jsQR-camera-result-populates-parent-token-explicit-GPS-and-only-one-scoped-attendance-save-390",
      "qr-download-uses-active-tab-bearer-and-revokes-private-url",
      "authorized-private-image-readback-and-object-url-cleanup-390",
      "configure-qr-location-private-evidence-review-and-approval-390",
      "oversized-video-keeps-submit-disabled-and-no-upload",
      "unmount-active-video-stops-synthetic-camera-and-microphone",
      "monotonic-duration-limit-automatically-stops-synthetic-audio",
      "authorized-private-audio-readback-decodes-and-revokes-object-url-390",
      "synthetic-native-audio-record-review-explicit-save-390",
      "monotonic-duration-limit-automatically-stops-synthetic-video",
      "authorized-private-video-readback-decodes-and-revokes-object-url-390",
      "synthetic-native-video-record-review-explicit-save-390",
      "qr-download-uses-active-tab-bearer-and-revokes-private-url",
      "private-media-download-active-tab-bearer-exact-bytes-and-url-cleanup",
      "context-change-revokes-private-preview-and-removes-stale-project-records",
      "qr-download-uses-active-tab-bearer-and-revokes-private-url",
      "private-media-download-active-tab-bearer-exact-bytes-and-url-cleanup",
      "authorized-private-image-readback-and-object-url-cleanup-390",
      "confirmed-approval-updates-task-and-keeps-receipt-when-refresh-fails-without-reposting",
      "proposal-review-read-fails-initial-participant-get-confirmed-before-reviewer-switch-390",
      "proposal-review-read-fails-exact-authorized-linked-files-distinct-reviewer-private-readback-390",
      "proposal-review-missing-initial-participant-get-confirmed-before-reviewer-switch-390",
      "proposal-review-missing-exact-authorized-linked-files-distinct-reviewer-private-readback-390",
      "proposal-review-wrong-task-initial-participant-get-confirmed-before-reviewer-switch-390",
      "proposal-review-wrong-task-exact-authorized-linked-files-distinct-reviewer-private-readback-390",
      "proposal-review-pending-initial-participant-get-confirmed-before-reviewer-switch-390",
      "proposal-review-pending-exact-authorized-linked-files-distinct-reviewer-private-readback-390",
      "proposal-review-processing-failed-initial-participant-get-confirmed-before-reviewer-switch-390",
      "proposal-review-processing-failed-exact-authorized-linked-files-distinct-reviewer-private-readback-390",
      "proposal-review-lookup-fails-initial-participant-get-confirmed-before-reviewer-switch-390",
      "proposal-review-lookup-fails-exact-authorized-linked-files-distinct-reviewer-private-readback-390",
      "proposal-review-lookup-extra-initial-participant-get-confirmed-before-reviewer-switch-390",
      "proposal-review-lookup-extra-exact-authorized-linked-files-distinct-reviewer-private-readback-390",
      "proposal-review-lookup-revision-initial-participant-get-confirmed-before-reviewer-switch-390",
      "proposal-review-lookup-revision-exact-authorized-linked-files-distinct-reviewer-private-readback-390",
      "proposal-review-lookup-context-change-initial-participant-get-confirmed-before-reviewer-switch-390",
      "targeted-proposal-metadata-and-private-preview-clear-on-workspace-context-change",
      "first-sector-CTA-requires-nonempty-coordinates-and-explicit-save-without-renewal-checkbox",
      "empty-site-participant-gets-useful-explanation-without-config-actions",
      "twenty-sector-edit-scrolls-without-animation-and-focuses-contextual-form-after-explicit-gesture",
      "twenty-sector-limit-blocks-add-but-preserves-IDs-when-editing-last-sector",
      "legacy-confirmed-receipt-QR-token-download-remains-supported",
      "configuration-409-preserves-draft-requires-fresh-GET-human-review-and-renewal-before-new-save",
      "sector-GPS-denied-preserves-manual-draft-and-never-POSTs",
      "sector-GPS-inaccurate-preserves-manual-draft-and-never-POSTs",
      "sector-GPS-stale-preserves-manual-draft-and-never-POSTs",
      "cancel-GPS-and-sector-draft-discard-late-native-callback-without-touching-new-draft",
      "real-context-remount-invalidates-pending-sector-GPS-and-private-draft",
      "sector-gps-denied-explicit-GET-invalidates-GPS-clears-config-draft-and-actions",
      "sector-gps-revoked-explicit-GET-invalidates-GPS-clears-config-draft-and-actions",
      "sector-qr-401-html-no-private-download-no-POST-hides-sector-data",
      "sector-qr-401-html-fresh-authorized-GET-restores-current-reprint-without-POST",
      "sector-qr-403-no-private-download-no-POST-hides-sector-data",
      "sector-qr-403-fresh-authorized-GET-restores-current-reprint-without-POST",
      "sector-qr-404-no-private-download-no-POST-hides-sector-data",
      "sector-qr-404-fresh-authorized-GET-restores-current-reprint-without-POST",
      "sector-qr-stale-no-private-download-no-POST-preserves-data-for-explicit-refresh",
      "sector-qr-stale-fresh-authorized-GET-restores-current-reprint-without-POST",
      "sector-qr-receipt-no-private-download-no-POST-preserves-data-for-explicit-refresh",
      "sector-qr-receipt-fresh-authorized-GET-restores-current-reprint-without-POST",
      "review-pagination-evidence-old-pending-pages-current-revision-explicit-decision-320",
      "review-pagination-progress-old-pending-pages-current-revision-explicit-decision-320",
      "review-pagination-author-old-pending-pages-current-revision-explicit-decision-320",
      "review-pagination-errors-old-pending-pages-current-revision-explicit-decision-320",
      "review-pagination-access-denied-private-selection-cleared-busy-released-explicit-get-restores-320",
      "review-pagination-eligibility-response-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-320",
      "review-pagination-eligibility-continuation-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-320",
      "review-pagination-eligibility-flags-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-320",
      "review-pagination-cursor-unavailable-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-320",
      "voice-accumulated-review-confirm-context-and-canonical-propose-320",
      "voice-delta-review-confirm-context-and-canonical-propose-320",
      "voice-unknown-review-confirm-context-and-canonical-propose-320",
      "voice-pending-review-confirm-context-and-canonical-propose-320",
      "voice-malformed-review-confirm-context-and-canonical-propose-320",
      "voice-task-changed-review-confirm-context-and-canonical-propose-320",
      "voice-source-page-review-confirm-context-and-canonical-propose-320",
      "voice-evidence-removed-review-confirm-context-and-canonical-propose-320",
      "voice-context-review-confirm-context-and-canonical-propose-320",
      "voice-conflict-review-confirm-context-and-canonical-propose-320",
      "voice-denied-review-confirm-context-and-canonical-propose-320",
      "review-pagination-evidence-old-pending-pages-current-revision-explicit-decision-390",
      "review-pagination-progress-old-pending-pages-current-revision-explicit-decision-390",
      "review-pagination-author-old-pending-pages-current-revision-explicit-decision-390",
      "review-pagination-errors-old-pending-pages-current-revision-explicit-decision-390",
      "review-pagination-access-denied-private-selection-cleared-busy-released-explicit-get-restores-390",
      "review-pagination-eligibility-response-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-390",
      "review-pagination-eligibility-continuation-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-390",
      "review-pagination-eligibility-flags-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-390",
      "review-pagination-cursor-unavailable-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-390",
      "voice-accumulated-review-confirm-context-and-canonical-propose-390",
      "voice-delta-review-confirm-context-and-canonical-propose-390",
      "voice-unknown-review-confirm-context-and-canonical-propose-390",
      "voice-pending-review-confirm-context-and-canonical-propose-390",
      "voice-malformed-review-confirm-context-and-canonical-propose-390",
      "voice-task-changed-review-confirm-context-and-canonical-propose-390",
      "voice-source-page-review-confirm-context-and-canonical-propose-390",
      "voice-evidence-removed-review-confirm-context-and-canonical-propose-390",
      "voice-context-review-confirm-context-and-canonical-propose-390",
      "voice-conflict-review-confirm-context-and-canonical-propose-390",
      "voice-denied-review-confirm-context-and-canonical-propose-390",
      "review-pagination-evidence-old-pending-pages-current-revision-explicit-decision-768",
      "review-pagination-progress-old-pending-pages-current-revision-explicit-decision-768",
      "review-pagination-author-old-pending-pages-current-revision-explicit-decision-768",
      "review-pagination-errors-old-pending-pages-current-revision-explicit-decision-768",
      "review-pagination-access-denied-private-selection-cleared-busy-released-explicit-get-restores-768",
      "review-pagination-eligibility-response-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-768",
      "review-pagination-eligibility-continuation-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-768",
      "review-pagination-eligibility-flags-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-768",
      "review-pagination-cursor-unavailable-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-768",
      "voice-accumulated-review-confirm-context-and-canonical-propose-768",
      "voice-delta-review-confirm-context-and-canonical-propose-768",
      "voice-unknown-review-confirm-context-and-canonical-propose-768",
      "voice-pending-review-confirm-context-and-canonical-propose-768",
      "voice-malformed-review-confirm-context-and-canonical-propose-768",
      "voice-task-changed-review-confirm-context-and-canonical-propose-768",
      "voice-source-page-review-confirm-context-and-canonical-propose-768",
      "voice-evidence-removed-review-confirm-context-and-canonical-propose-768",
      "voice-context-review-confirm-context-and-canonical-propose-768",
      "voice-conflict-review-confirm-context-and-canonical-propose-768",
      "voice-denied-review-confirm-context-and-canonical-propose-768",
      "review-pagination-evidence-old-pending-pages-current-revision-explicit-decision-1280",
      "review-pagination-progress-old-pending-pages-current-revision-explicit-decision-1280",
      "review-pagination-author-old-pending-pages-current-revision-explicit-decision-1280",
      "review-pagination-errors-old-pending-pages-current-revision-explicit-decision-1280",
      "review-pagination-access-denied-private-selection-cleared-busy-released-explicit-get-restores-1280",
      "review-pagination-eligibility-response-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-1280",
      "review-pagination-eligibility-continuation-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-1280",
      "review-pagination-eligibility-flags-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-1280",
      "review-pagination-cursor-unavailable-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-1280",
      "voice-accumulated-review-confirm-context-and-canonical-propose-1280",
      "voice-delta-review-confirm-context-and-canonical-propose-1280",
      "voice-unknown-review-confirm-context-and-canonical-propose-1280",
      "voice-pending-review-confirm-context-and-canonical-propose-1280",
      "voice-malformed-review-confirm-context-and-canonical-propose-1280",
      "voice-task-changed-review-confirm-context-and-canonical-propose-1280",
      "voice-source-page-review-confirm-context-and-canonical-propose-1280",
      "voice-evidence-removed-review-confirm-context-and-canonical-propose-1280",
      "voice-context-review-confirm-context-and-canonical-propose-1280",
      "voice-conflict-review-confirm-context-and-canonical-propose-1280",
      "voice-denied-review-confirm-context-and-canonical-propose-1280",
      "media-lease-live-reload-and-explicit-consent-respect-server-expiration-320",
      "media-lease-expired-reload-and-explicit-consent-respect-server-expiration-320",
      "media-lease-revoked-reload-and-explicit-consent-respect-server-expiration-320",
      "access-recovery-processing-clock-ahead-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-recovery-processing-expired-clock-behind-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "media-lease-live-reload-and-explicit-consent-respect-server-expiration-390",
      "media-lease-expired-reload-and-explicit-consent-respect-server-expiration-390",
      "media-lease-revoked-reload-and-explicit-consent-respect-server-expiration-390",
      "access-recovery-processing-clock-ahead-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-recovery-processing-expired-clock-behind-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "media-lease-live-reload-and-explicit-consent-respect-server-expiration-768",
      "media-lease-expired-reload-and-explicit-consent-respect-server-expiration-768",
      "media-lease-revoked-reload-and-explicit-consent-respect-server-expiration-768",
      "access-recovery-processing-clock-ahead-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-recovery-processing-expired-clock-behind-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "media-lease-live-reload-and-explicit-consent-respect-server-expiration-1280",
      "media-lease-expired-reload-and-explicit-consent-respect-server-expiration-1280",
      "media-lease-revoked-reload-and-explicit-consent-respect-server-expiration-1280",
      "access-recovery-processing-clock-ahead-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-recovery-processing-expired-clock-behind-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "video-audio-optin-explicit-scope-private-result-and-no-automatic-progress-320",
      "video-audio-decline-explicit-scope-private-result-and-no-automatic-progress-320",
      "video-audio-cancel-explicit-scope-private-result-and-no-automatic-progress-320",
      "video-audio-context-explicit-scope-private-result-and-no-automatic-progress-320",
      "video-audio-revoked-explicit-scope-private-result-and-no-automatic-progress-320",
      "video-audio-transcript-explicit-scope-private-result-and-no-automatic-progress-320",
      "video-audio-unconfirmed-explicit-scope-private-result-and-no-automatic-progress-320",
      "video-audio-no-track-explicit-scope-private-result-and-no-automatic-progress-320",
      "video-audio-silence-explicit-scope-private-result-and-no-automatic-progress-320",
      "video-audio-progress-approved-video-human-confirmation-current-task-cas-and-once-only-propose-320",
      "video-audio-visual-unconfirmed-extracted-frames-unconfirmed-vision-confirmed-transcript-and-no-automatic-progress-320",
      "video-audio-optin-explicit-scope-private-result-and-no-automatic-progress-390",
      "video-audio-decline-explicit-scope-private-result-and-no-automatic-progress-390",
      "video-audio-cancel-explicit-scope-private-result-and-no-automatic-progress-390",
      "video-audio-context-explicit-scope-private-result-and-no-automatic-progress-390",
      "video-audio-revoked-explicit-scope-private-result-and-no-automatic-progress-390",
      "video-audio-transcript-explicit-scope-private-result-and-no-automatic-progress-390",
      "video-audio-unconfirmed-explicit-scope-private-result-and-no-automatic-progress-390",
      "video-audio-no-track-explicit-scope-private-result-and-no-automatic-progress-390",
      "video-audio-silence-explicit-scope-private-result-and-no-automatic-progress-390",
      "video-audio-progress-approved-video-human-confirmation-current-task-cas-and-once-only-propose-390",
      "video-audio-visual-unconfirmed-extracted-frames-unconfirmed-vision-confirmed-transcript-and-no-automatic-progress-390",
      "video-audio-optin-explicit-scope-private-result-and-no-automatic-progress-768",
      "video-audio-decline-explicit-scope-private-result-and-no-automatic-progress-768",
      "video-audio-cancel-explicit-scope-private-result-and-no-automatic-progress-768",
      "video-audio-context-explicit-scope-private-result-and-no-automatic-progress-768",
      "video-audio-revoked-explicit-scope-private-result-and-no-automatic-progress-768",
      "video-audio-transcript-explicit-scope-private-result-and-no-automatic-progress-768",
      "video-audio-unconfirmed-explicit-scope-private-result-and-no-automatic-progress-768",
      "video-audio-no-track-explicit-scope-private-result-and-no-automatic-progress-768",
      "video-audio-silence-explicit-scope-private-result-and-no-automatic-progress-768",
      "video-audio-progress-approved-video-human-confirmation-current-task-cas-and-once-only-propose-768",
      "video-audio-visual-unconfirmed-extracted-frames-unconfirmed-vision-confirmed-transcript-and-no-automatic-progress-768",
      "video-audio-optin-explicit-scope-private-result-and-no-automatic-progress-1280",
      "video-audio-decline-explicit-scope-private-result-and-no-automatic-progress-1280",
      "video-audio-cancel-explicit-scope-private-result-and-no-automatic-progress-1280",
      "video-audio-context-explicit-scope-private-result-and-no-automatic-progress-1280",
      "video-audio-revoked-explicit-scope-private-result-and-no-automatic-progress-1280",
      "video-audio-transcript-explicit-scope-private-result-and-no-automatic-progress-1280",
      "video-audio-unconfirmed-explicit-scope-private-result-and-no-automatic-progress-1280",
      "video-audio-no-track-explicit-scope-private-result-and-no-automatic-progress-1280",
      "video-audio-silence-explicit-scope-private-result-and-no-automatic-progress-1280",
      "video-audio-progress-approved-video-human-confirmation-current-task-cas-and-once-only-propose-1280",
      "video-audio-visual-unconfirmed-extracted-frames-unconfirmed-vision-confirmed-transcript-and-no-automatic-progress-1280",
      "progress-self-review-own-proposal-needs-other-reviewer-and-canonical-rejection-does-not-lock-panel-320",
      "progress-self-review-stale-own-proposal-needs-other-reviewer-and-canonical-rejection-does-not-lock-panel-320",
      "progress-self-review-own-proposal-needs-other-reviewer-and-canonical-rejection-does-not-lock-panel-390",
      "progress-self-review-stale-own-proposal-needs-other-reviewer-and-canonical-rejection-does-not-lock-panel-390",
      "progress-self-review-own-proposal-needs-other-reviewer-and-canonical-rejection-does-not-lock-panel-768",
      "progress-self-review-stale-own-proposal-needs-other-reviewer-and-canonical-rejection-does-not-lock-panel-768",
      "progress-self-review-own-proposal-needs-other-reviewer-and-canonical-rejection-does-not-lock-panel-1280",
      "progress-self-review-stale-own-proposal-needs-other-reviewer-and-canonical-rejection-does-not-lock-panel-1280"
    ],
    "previousRepeatedCheckNames": [
      {
        "name": "access-post-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
        "count": 4
      },
      {
        "name": "access-refresh-401-confirmed-receipt-clears-private-state-with-no-new-attempt",
        "count": 4
      },
      {
        "name": "access-recovery-file-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
        "count": 4
      },
      {
        "name": "access-retry-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
        "count": 4
      },
      {
        "name": "qr-download-uses-active-tab-bearer-and-revokes-private-url",
        "count": 8
      },
      {
        "name": "private-media-download-active-tab-bearer-exact-bytes-and-url-cleanup",
        "count": 6
      },
      {
        "name": "authorized-private-image-readback-and-object-url-cleanup-390",
        "count": 3
      },
      {
        "name": "configure-qr-location-private-evidence-review-and-approval-390",
        "count": 2
      },
      {
        "name": "authorized-private-audio-readback-decodes-and-revokes-object-url-390",
        "count": 2
      },
      {
        "name": "synthetic-native-audio-record-review-explicit-save-390",
        "count": 2
      },
      {
        "name": "authorized-private-video-readback-decodes-and-revokes-object-url-390",
        "count": 2
      },
      {
        "name": "synthetic-native-video-record-review-explicit-save-390",
        "count": 2
      },
      {
        "name": "access-recovery-processing-clock-ahead-retains-exact-private-attempt-requires-scoped-GET-before-replay",
        "count": 4
      },
      {
        "name": "access-recovery-processing-expired-clock-behind-retains-exact-private-attempt-requires-scoped-GET-before-replay",
        "count": 4
      }
    ],
    "addedCheckNames": [
      "review-pagination-home-open-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-320",
      "review-pagination-home-draft-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-320",
      "review-pagination-home-uncertain-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-320",
      "review-pagination-home-media-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-320",
      "review-pagination-home-gps-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-320",
      "review-pagination-home-role-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-320",
      "review-pagination-home-denied-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-320",
      "review-pagination-home-stamp-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-320",
      "review-pagination-home-flags-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-320",
      "review-pagination-home-open-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-390",
      "review-pagination-home-draft-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-390",
      "review-pagination-home-uncertain-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-390",
      "review-pagination-home-media-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-390",
      "review-pagination-home-gps-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-390",
      "review-pagination-home-role-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-390",
      "review-pagination-home-denied-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-390",
      "review-pagination-home-stamp-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-390",
      "review-pagination-home-flags-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-390",
      "review-pagination-home-open-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-768",
      "review-pagination-home-draft-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-768",
      "review-pagination-home-uncertain-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-768",
      "review-pagination-home-media-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-768",
      "review-pagination-home-gps-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-768",
      "review-pagination-home-role-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-768",
      "review-pagination-home-denied-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-768",
      "review-pagination-home-stamp-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-768",
      "review-pagination-home-flags-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-768",
      "review-pagination-home-open-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-1280",
      "review-pagination-home-draft-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-1280",
      "review-pagination-home-uncertain-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-1280",
      "review-pagination-home-media-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-1280",
      "review-pagination-home-gps-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-1280",
      "review-pagination-home-role-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-1280",
      "review-pagination-home-denied-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-1280",
      "review-pagination-home-stamp-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-1280",
      "review-pagination-home-flags-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-1280"
    ],
    "currentCheckNames": [
      "access-load-401-clears-private-state-and-URLs-after-late-GET-320",
      "access-load-403-clears-private-state-and-URLs-after-late-GET-320",
      "access-load-html-401-clears-private-state-and-URLs-after-late-GET-320",
      "access-load-context-clears-private-state-and-URLs-after-late-GET-320",
      "access-post-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-refresh-401-confirmed-receipt-clears-private-state-with-no-new-attempt",
      "access-recovery-file-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-retry-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "qr-download-uses-active-tab-bearer-and-revokes-private-url",
      "private-media-download-active-tab-bearer-exact-bytes-and-url-cleanup",
      "authorized-private-image-readback-and-object-url-cleanup-320",
      "configure-qr-location-private-evidence-review-and-approval-320",
      "proposal-review-initial-participant-get-confirmed-before-reviewer-switch-320",
      "proposal-review-exact-authorized-linked-files-distinct-reviewer-private-readback-320",
      "journey-actions-follow-canonical-sequence-and-recorded-review-pending-ingress-exit-320",
      "attendance-revision-fresh-manual-current-journey-preserves-draft-and-exact-rejection-journal-320",
      "attendance-revision-retry-manual-current-journey-preserves-draft-and-exact-rejection-journal-320",
      "attendance-revision-invalid-manual-current-journey-preserves-draft-and-exact-rejection-journal-320",
      "attendance-revision-gps-stale-manual-current-journey-preserves-draft-and-exact-rejection-journal-320",
      "attendance-gps-cancel-success-local-cancel-protects-draft-callback-and-receipt-320",
      "attendance-gps-cancel-error-local-cancel-protects-draft-callback-and-receipt-320",
      "attendance-gps-retry-local-cancel-protects-draft-callback-and-receipt-320",
      "attendance-gps-draft-cancel-local-cancel-protects-draft-callback-and-receipt-320",
      "attendance-gps-context-local-cancel-protects-draft-callback-and-receipt-320",
      "attendance-gps-uncertain-local-cancel-protects-draft-callback-and-receipt-320",
      "draft-preservation-file-save-retains-draft-with-own-controls-320",
      "draft-preservation-file-cancel-retains-draft-with-own-controls-320",
      "draft-preservation-form-retains-draft-with-own-controls-320",
      "draft-preservation-review-retains-draft-with-own-controls-320",
      "draft-preservation-voice-retains-draft-with-own-controls-320",
      "large-original-preserved-local-photo-prepared-rotated-explicit-save-320",
      "authorized-private-audio-readback-decodes-and-revokes-object-url-320",
      "synthetic-native-audio-record-review-explicit-save-320",
      "authorized-private-video-readback-decodes-and-revokes-object-url-320",
      "synthetic-native-video-record-review-explicit-save-320",
      "own-worker-canonical-incident-and-material-drafts-320",
      "current-QR-reprints-after-reload-by-sector-authenticated-GET-without-POST-320",
      "QR-renewal-explicit-checkbox-and-cancel-never-write-320",
      "nonfirst-sector-edit-preserves-other-sector-ID-and-coordinates-320",
      "sector-bounds-empty-not-zero-integer-radius-consented-GPS-prepares-locally-320",
      "selected-sector-tab-GPS-and-primary-save-hover-text-remain-readable-320",
      "new-sector-appends-with-preserved-existing-sectors-no-GPS-or-token-storage-320",
      "access-load-401-clears-private-state-and-URLs-after-late-GET-390",
      "access-load-403-clears-private-state-and-URLs-after-late-GET-390",
      "access-load-html-401-clears-private-state-and-URLs-after-late-GET-390",
      "access-load-context-clears-private-state-and-URLs-after-late-GET-390",
      "access-post-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-refresh-401-confirmed-receipt-clears-private-state-with-no-new-attempt",
      "access-recovery-file-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-retry-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "qr-download-uses-active-tab-bearer-and-revokes-private-url",
      "private-media-download-active-tab-bearer-exact-bytes-and-url-cleanup",
      "authorized-private-image-readback-and-object-url-cleanup-390",
      "configure-qr-location-private-evidence-review-and-approval-390",
      "proposal-review-initial-participant-get-confirmed-before-reviewer-switch-390",
      "proposal-review-exact-authorized-linked-files-distinct-reviewer-private-readback-390",
      "journey-actions-follow-canonical-sequence-and-recorded-review-pending-ingress-exit-390",
      "attendance-revision-fresh-manual-current-journey-preserves-draft-and-exact-rejection-journal-390",
      "attendance-revision-retry-manual-current-journey-preserves-draft-and-exact-rejection-journal-390",
      "attendance-revision-invalid-manual-current-journey-preserves-draft-and-exact-rejection-journal-390",
      "attendance-revision-gps-stale-manual-current-journey-preserves-draft-and-exact-rejection-journal-390",
      "attendance-gps-cancel-success-local-cancel-protects-draft-callback-and-receipt-390",
      "attendance-gps-cancel-error-local-cancel-protects-draft-callback-and-receipt-390",
      "attendance-gps-retry-local-cancel-protects-draft-callback-and-receipt-390",
      "attendance-gps-draft-cancel-local-cancel-protects-draft-callback-and-receipt-390",
      "attendance-gps-context-local-cancel-protects-draft-callback-and-receipt-390",
      "attendance-gps-uncertain-local-cancel-protects-draft-callback-and-receipt-390",
      "draft-preservation-file-save-retains-draft-with-own-controls-390",
      "draft-preservation-file-cancel-retains-draft-with-own-controls-390",
      "draft-preservation-form-retains-draft-with-own-controls-390",
      "draft-preservation-review-retains-draft-with-own-controls-390",
      "draft-preservation-voice-retains-draft-with-own-controls-390",
      "large-original-preserved-local-photo-prepared-rotated-explicit-save-390",
      "authorized-private-audio-readback-decodes-and-revokes-object-url-390",
      "synthetic-native-audio-record-review-explicit-save-390",
      "authorized-private-video-readback-decodes-and-revokes-object-url-390",
      "synthetic-native-video-record-review-explicit-save-390",
      "own-worker-canonical-incident-and-material-drafts-390",
      "current-QR-reprints-after-reload-by-sector-authenticated-GET-without-POST-390",
      "QR-renewal-explicit-checkbox-and-cancel-never-write-390",
      "nonfirst-sector-edit-preserves-other-sector-ID-and-coordinates-390",
      "sector-bounds-empty-not-zero-integer-radius-consented-GPS-prepares-locally-390",
      "selected-sector-tab-GPS-and-primary-save-hover-text-remain-readable-390",
      "new-sector-appends-with-preserved-existing-sectors-no-GPS-or-token-storage-390",
      "access-load-401-clears-private-state-and-URLs-after-late-GET-768",
      "access-load-403-clears-private-state-and-URLs-after-late-GET-768",
      "access-load-html-401-clears-private-state-and-URLs-after-late-GET-768",
      "access-load-context-clears-private-state-and-URLs-after-late-GET-768",
      "access-post-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-refresh-401-confirmed-receipt-clears-private-state-with-no-new-attempt",
      "access-recovery-file-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-retry-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "qr-download-uses-active-tab-bearer-and-revokes-private-url",
      "private-media-download-active-tab-bearer-exact-bytes-and-url-cleanup",
      "authorized-private-image-readback-and-object-url-cleanup-768",
      "configure-qr-location-private-evidence-review-and-approval-768",
      "proposal-review-initial-participant-get-confirmed-before-reviewer-switch-768",
      "proposal-review-exact-authorized-linked-files-distinct-reviewer-private-readback-768",
      "journey-actions-follow-canonical-sequence-and-recorded-review-pending-ingress-exit-768",
      "attendance-revision-fresh-manual-current-journey-preserves-draft-and-exact-rejection-journal-768",
      "attendance-revision-retry-manual-current-journey-preserves-draft-and-exact-rejection-journal-768",
      "attendance-revision-invalid-manual-current-journey-preserves-draft-and-exact-rejection-journal-768",
      "attendance-revision-gps-stale-manual-current-journey-preserves-draft-and-exact-rejection-journal-768",
      "attendance-gps-cancel-success-local-cancel-protects-draft-callback-and-receipt-768",
      "attendance-gps-cancel-error-local-cancel-protects-draft-callback-and-receipt-768",
      "attendance-gps-retry-local-cancel-protects-draft-callback-and-receipt-768",
      "attendance-gps-draft-cancel-local-cancel-protects-draft-callback-and-receipt-768",
      "attendance-gps-context-local-cancel-protects-draft-callback-and-receipt-768",
      "attendance-gps-uncertain-local-cancel-protects-draft-callback-and-receipt-768",
      "draft-preservation-file-save-retains-draft-with-own-controls-768",
      "draft-preservation-file-cancel-retains-draft-with-own-controls-768",
      "draft-preservation-form-retains-draft-with-own-controls-768",
      "draft-preservation-review-retains-draft-with-own-controls-768",
      "draft-preservation-voice-retains-draft-with-own-controls-768",
      "large-original-preserved-local-photo-prepared-rotated-explicit-save-768",
      "authorized-private-audio-readback-decodes-and-revokes-object-url-768",
      "synthetic-native-audio-record-review-explicit-save-768",
      "authorized-private-video-readback-decodes-and-revokes-object-url-768",
      "synthetic-native-video-record-review-explicit-save-768",
      "own-worker-canonical-incident-and-material-drafts-768",
      "current-QR-reprints-after-reload-by-sector-authenticated-GET-without-POST-768",
      "QR-renewal-explicit-checkbox-and-cancel-never-write-768",
      "nonfirst-sector-edit-preserves-other-sector-ID-and-coordinates-768",
      "sector-bounds-empty-not-zero-integer-radius-consented-GPS-prepares-locally-768",
      "selected-sector-tab-GPS-and-primary-save-hover-text-remain-readable-768",
      "new-sector-appends-with-preserved-existing-sectors-no-GPS-or-token-storage-768",
      "access-load-401-clears-private-state-and-URLs-after-late-GET-1280",
      "access-load-403-clears-private-state-and-URLs-after-late-GET-1280",
      "access-load-html-401-clears-private-state-and-URLs-after-late-GET-1280",
      "access-load-context-clears-private-state-and-URLs-after-late-GET-1280",
      "access-post-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-refresh-401-confirmed-receipt-clears-private-state-with-no-new-attempt",
      "access-recovery-file-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-retry-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "qr-download-uses-active-tab-bearer-and-revokes-private-url",
      "private-media-download-active-tab-bearer-exact-bytes-and-url-cleanup",
      "authorized-private-image-readback-and-object-url-cleanup-1280",
      "configure-qr-location-private-evidence-review-and-approval-1280",
      "proposal-review-initial-participant-get-confirmed-before-reviewer-switch-1280",
      "proposal-review-exact-authorized-linked-files-distinct-reviewer-private-readback-1280",
      "journey-actions-follow-canonical-sequence-and-recorded-review-pending-ingress-exit-1280",
      "attendance-revision-fresh-manual-current-journey-preserves-draft-and-exact-rejection-journal-1280",
      "attendance-revision-retry-manual-current-journey-preserves-draft-and-exact-rejection-journal-1280",
      "attendance-revision-invalid-manual-current-journey-preserves-draft-and-exact-rejection-journal-1280",
      "attendance-revision-gps-stale-manual-current-journey-preserves-draft-and-exact-rejection-journal-1280",
      "attendance-gps-cancel-success-local-cancel-protects-draft-callback-and-receipt-1280",
      "attendance-gps-cancel-error-local-cancel-protects-draft-callback-and-receipt-1280",
      "attendance-gps-retry-local-cancel-protects-draft-callback-and-receipt-1280",
      "attendance-gps-draft-cancel-local-cancel-protects-draft-callback-and-receipt-1280",
      "attendance-gps-context-local-cancel-protects-draft-callback-and-receipt-1280",
      "attendance-gps-uncertain-local-cancel-protects-draft-callback-and-receipt-1280",
      "draft-preservation-file-save-retains-draft-with-own-controls-1280",
      "draft-preservation-file-cancel-retains-draft-with-own-controls-1280",
      "draft-preservation-form-retains-draft-with-own-controls-1280",
      "draft-preservation-review-retains-draft-with-own-controls-1280",
      "draft-preservation-voice-retains-draft-with-own-controls-1280",
      "large-original-preserved-local-photo-prepared-rotated-explicit-save-1280",
      "authorized-private-audio-readback-decodes-and-revokes-object-url-1280",
      "synthetic-native-audio-record-review-explicit-save-1280",
      "authorized-private-video-readback-decodes-and-revokes-object-url-1280",
      "synthetic-native-video-record-review-explicit-save-1280",
      "own-worker-canonical-incident-and-material-drafts-1280",
      "current-QR-reprints-after-reload-by-sector-authenticated-GET-without-POST-1280",
      "QR-renewal-explicit-checkbox-and-cancel-never-write-1280",
      "nonfirst-sector-edit-preserves-other-sector-ID-and-coordinates-1280",
      "sector-bounds-empty-not-zero-integer-radius-consented-GPS-prepares-locally-1280",
      "selected-sector-tab-GPS-and-primary-save-hover-text-remain-readable-1280",
      "new-sector-appends-with-preserved-existing-sectors-no-GPS-or-token-storage-1280",
      "access-camera-context-late-device-callback-cannot-restore-private-draft",
      "access-location-context-late-device-callback-cannot-restore-private-draft",
      "access-load-qr-403-clears-private-state-and-URLs-after-late-GET-390",
      "access-load-project-clears-private-state-and-URLs-after-late-GET-390",
      "access-load-404-clears-private-state-and-URLs-after-late-GET-390",
      "access-load-draft-403-clears-private-state-and-URLs-after-late-GET-390",
      "access-post-context-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-post-process-403-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "fresh-PROCESS-denial-keeps-reference-through-denied-GET-and-reload-recovers-only-by-GET",
      "access-post-html-401-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-refresh-context-confirmed-receipt-clears-private-state-with-no-new-attempt",
      "access-recovery-html-401-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-recovery-context-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-recovery-malformed-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "validated-PROCESSING-remains-blocked-until-RECORDED-recovery-with-no-extra-POST",
      "access-recovery-processing-expired-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-recovery-processing-bad-date-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "ordinary-500-keeps-local-file-and-draft-with-no-POST",
      "journey-uses-canonical-sequence-over-list-order-and-preserves-revision",
      "journey-chooses-eligible-own-worker-and-filters-ineligible-fiches-without-post",
      "applied-and-rejected-proposals-show-recorded-decision-date-without-expiration",
      "field-draft-locks-project-until-explicit-cancel",
      "qr-download-uses-active-tab-bearer-and-revokes-private-url",
      "field-private-file-draft-locks-project-until-explicit-cancel",
      "expired-proposal-displays-deadline-without-authorizing-or-changing-progress",
      "uncertain-save-recovery-does-not-send-a-second-POST",
      "stale-revision-preserves-the-complete-form",
      "denied-project-never-shows-example-records",
      "explicit-recording-cancel-stops-synthetic-microphone-without-upload",
      "cancel-pending-permission-stops-late-synthetic-stream",
      "permission-denial-preserves-form-and-supports-file-fallback",
      "unsupported-photo-keeps-submit-disabled-with-actionable-message",
      "native-qr-explicit-start-cancel-stops-synthetic-camera",
      "real-local-jsQR-camera-result-populates-parent-token-explicit-GPS-and-only-one-scoped-attendance-save-390",
      "qr-download-uses-active-tab-bearer-and-revokes-private-url",
      "authorized-private-image-readback-and-object-url-cleanup-390",
      "configure-qr-location-private-evidence-review-and-approval-390",
      "oversized-video-keeps-submit-disabled-and-no-upload",
      "unmount-active-video-stops-synthetic-camera-and-microphone",
      "monotonic-duration-limit-automatically-stops-synthetic-audio",
      "authorized-private-audio-readback-decodes-and-revokes-object-url-390",
      "synthetic-native-audio-record-review-explicit-save-390",
      "monotonic-duration-limit-automatically-stops-synthetic-video",
      "authorized-private-video-readback-decodes-and-revokes-object-url-390",
      "synthetic-native-video-record-review-explicit-save-390",
      "qr-download-uses-active-tab-bearer-and-revokes-private-url",
      "private-media-download-active-tab-bearer-exact-bytes-and-url-cleanup",
      "context-change-revokes-private-preview-and-removes-stale-project-records",
      "qr-download-uses-active-tab-bearer-and-revokes-private-url",
      "private-media-download-active-tab-bearer-exact-bytes-and-url-cleanup",
      "authorized-private-image-readback-and-object-url-cleanup-390",
      "confirmed-approval-updates-task-and-keeps-receipt-when-refresh-fails-without-reposting",
      "proposal-review-read-fails-initial-participant-get-confirmed-before-reviewer-switch-390",
      "proposal-review-read-fails-exact-authorized-linked-files-distinct-reviewer-private-readback-390",
      "proposal-review-missing-initial-participant-get-confirmed-before-reviewer-switch-390",
      "proposal-review-missing-exact-authorized-linked-files-distinct-reviewer-private-readback-390",
      "proposal-review-wrong-task-initial-participant-get-confirmed-before-reviewer-switch-390",
      "proposal-review-wrong-task-exact-authorized-linked-files-distinct-reviewer-private-readback-390",
      "proposal-review-pending-initial-participant-get-confirmed-before-reviewer-switch-390",
      "proposal-review-pending-exact-authorized-linked-files-distinct-reviewer-private-readback-390",
      "proposal-review-processing-failed-initial-participant-get-confirmed-before-reviewer-switch-390",
      "proposal-review-processing-failed-exact-authorized-linked-files-distinct-reviewer-private-readback-390",
      "proposal-review-lookup-fails-initial-participant-get-confirmed-before-reviewer-switch-390",
      "proposal-review-lookup-fails-exact-authorized-linked-files-distinct-reviewer-private-readback-390",
      "proposal-review-lookup-extra-initial-participant-get-confirmed-before-reviewer-switch-390",
      "proposal-review-lookup-extra-exact-authorized-linked-files-distinct-reviewer-private-readback-390",
      "proposal-review-lookup-revision-initial-participant-get-confirmed-before-reviewer-switch-390",
      "proposal-review-lookup-revision-exact-authorized-linked-files-distinct-reviewer-private-readback-390",
      "proposal-review-lookup-context-change-initial-participant-get-confirmed-before-reviewer-switch-390",
      "targeted-proposal-metadata-and-private-preview-clear-on-workspace-context-change",
      "first-sector-CTA-requires-nonempty-coordinates-and-explicit-save-without-renewal-checkbox",
      "empty-site-participant-gets-useful-explanation-without-config-actions",
      "twenty-sector-edit-scrolls-without-animation-and-focuses-contextual-form-after-explicit-gesture",
      "twenty-sector-limit-blocks-add-but-preserves-IDs-when-editing-last-sector",
      "legacy-confirmed-receipt-QR-token-download-remains-supported",
      "configuration-409-preserves-draft-requires-fresh-GET-human-review-and-renewal-before-new-save",
      "sector-GPS-denied-preserves-manual-draft-and-never-POSTs",
      "sector-GPS-inaccurate-preserves-manual-draft-and-never-POSTs",
      "sector-GPS-stale-preserves-manual-draft-and-never-POSTs",
      "cancel-GPS-and-sector-draft-discard-late-native-callback-without-touching-new-draft",
      "real-context-remount-invalidates-pending-sector-GPS-and-private-draft",
      "sector-gps-denied-explicit-GET-invalidates-GPS-clears-config-draft-and-actions",
      "sector-gps-revoked-explicit-GET-invalidates-GPS-clears-config-draft-and-actions",
      "sector-qr-401-html-no-private-download-no-POST-hides-sector-data",
      "sector-qr-401-html-fresh-authorized-GET-restores-current-reprint-without-POST",
      "sector-qr-403-no-private-download-no-POST-hides-sector-data",
      "sector-qr-403-fresh-authorized-GET-restores-current-reprint-without-POST",
      "sector-qr-404-no-private-download-no-POST-hides-sector-data",
      "sector-qr-404-fresh-authorized-GET-restores-current-reprint-without-POST",
      "sector-qr-stale-no-private-download-no-POST-preserves-data-for-explicit-refresh",
      "sector-qr-stale-fresh-authorized-GET-restores-current-reprint-without-POST",
      "sector-qr-receipt-no-private-download-no-POST-preserves-data-for-explicit-refresh",
      "sector-qr-receipt-fresh-authorized-GET-restores-current-reprint-without-POST",
      "review-pagination-evidence-old-pending-pages-current-revision-explicit-decision-320",
      "review-pagination-progress-old-pending-pages-current-revision-explicit-decision-320",
      "review-pagination-author-old-pending-pages-current-revision-explicit-decision-320",
      "review-pagination-errors-old-pending-pages-current-revision-explicit-decision-320",
      "review-pagination-access-denied-private-selection-cleared-busy-released-explicit-get-restores-320",
      "review-pagination-eligibility-response-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-320",
      "review-pagination-eligibility-continuation-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-320",
      "review-pagination-eligibility-flags-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-320",
      "review-pagination-cursor-unavailable-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-320",
      "voice-accumulated-review-confirm-context-and-canonical-propose-320",
      "voice-delta-review-confirm-context-and-canonical-propose-320",
      "voice-unknown-review-confirm-context-and-canonical-propose-320",
      "voice-pending-review-confirm-context-and-canonical-propose-320",
      "voice-malformed-review-confirm-context-and-canonical-propose-320",
      "voice-task-changed-review-confirm-context-and-canonical-propose-320",
      "voice-source-page-review-confirm-context-and-canonical-propose-320",
      "voice-evidence-removed-review-confirm-context-and-canonical-propose-320",
      "voice-context-review-confirm-context-and-canonical-propose-320",
      "voice-conflict-review-confirm-context-and-canonical-propose-320",
      "voice-denied-review-confirm-context-and-canonical-propose-320",
      "review-pagination-home-open-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-320",
      "review-pagination-home-draft-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-320",
      "review-pagination-home-uncertain-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-320",
      "review-pagination-home-media-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-320",
      "review-pagination-home-gps-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-320",
      "review-pagination-home-role-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-320",
      "review-pagination-home-denied-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-320",
      "review-pagination-home-stamp-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-320",
      "review-pagination-home-flags-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-320",
      "review-pagination-evidence-old-pending-pages-current-revision-explicit-decision-390",
      "review-pagination-progress-old-pending-pages-current-revision-explicit-decision-390",
      "review-pagination-author-old-pending-pages-current-revision-explicit-decision-390",
      "review-pagination-errors-old-pending-pages-current-revision-explicit-decision-390",
      "review-pagination-access-denied-private-selection-cleared-busy-released-explicit-get-restores-390",
      "review-pagination-eligibility-response-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-390",
      "review-pagination-eligibility-continuation-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-390",
      "review-pagination-eligibility-flags-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-390",
      "review-pagination-cursor-unavailable-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-390",
      "voice-accumulated-review-confirm-context-and-canonical-propose-390",
      "voice-delta-review-confirm-context-and-canonical-propose-390",
      "voice-unknown-review-confirm-context-and-canonical-propose-390",
      "voice-pending-review-confirm-context-and-canonical-propose-390",
      "voice-malformed-review-confirm-context-and-canonical-propose-390",
      "voice-task-changed-review-confirm-context-and-canonical-propose-390",
      "voice-source-page-review-confirm-context-and-canonical-propose-390",
      "voice-evidence-removed-review-confirm-context-and-canonical-propose-390",
      "voice-context-review-confirm-context-and-canonical-propose-390",
      "voice-conflict-review-confirm-context-and-canonical-propose-390",
      "voice-denied-review-confirm-context-and-canonical-propose-390",
      "review-pagination-home-open-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-390",
      "review-pagination-home-draft-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-390",
      "review-pagination-home-uncertain-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-390",
      "review-pagination-home-media-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-390",
      "review-pagination-home-gps-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-390",
      "review-pagination-home-role-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-390",
      "review-pagination-home-denied-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-390",
      "review-pagination-home-stamp-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-390",
      "review-pagination-home-flags-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-390",
      "review-pagination-evidence-old-pending-pages-current-revision-explicit-decision-768",
      "review-pagination-progress-old-pending-pages-current-revision-explicit-decision-768",
      "review-pagination-author-old-pending-pages-current-revision-explicit-decision-768",
      "review-pagination-errors-old-pending-pages-current-revision-explicit-decision-768",
      "review-pagination-access-denied-private-selection-cleared-busy-released-explicit-get-restores-768",
      "review-pagination-eligibility-response-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-768",
      "review-pagination-eligibility-continuation-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-768",
      "review-pagination-eligibility-flags-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-768",
      "review-pagination-cursor-unavailable-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-768",
      "voice-accumulated-review-confirm-context-and-canonical-propose-768",
      "voice-delta-review-confirm-context-and-canonical-propose-768",
      "voice-unknown-review-confirm-context-and-canonical-propose-768",
      "voice-pending-review-confirm-context-and-canonical-propose-768",
      "voice-malformed-review-confirm-context-and-canonical-propose-768",
      "voice-task-changed-review-confirm-context-and-canonical-propose-768",
      "voice-source-page-review-confirm-context-and-canonical-propose-768",
      "voice-evidence-removed-review-confirm-context-and-canonical-propose-768",
      "voice-context-review-confirm-context-and-canonical-propose-768",
      "voice-conflict-review-confirm-context-and-canonical-propose-768",
      "voice-denied-review-confirm-context-and-canonical-propose-768",
      "review-pagination-home-open-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-768",
      "review-pagination-home-draft-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-768",
      "review-pagination-home-uncertain-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-768",
      "review-pagination-home-media-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-768",
      "review-pagination-home-gps-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-768",
      "review-pagination-home-role-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-768",
      "review-pagination-home-denied-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-768",
      "review-pagination-home-stamp-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-768",
      "review-pagination-home-flags-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-768",
      "review-pagination-evidence-old-pending-pages-current-revision-explicit-decision-1280",
      "review-pagination-progress-old-pending-pages-current-revision-explicit-decision-1280",
      "review-pagination-author-old-pending-pages-current-revision-explicit-decision-1280",
      "review-pagination-errors-old-pending-pages-current-revision-explicit-decision-1280",
      "review-pagination-access-denied-private-selection-cleared-busy-released-explicit-get-restores-1280",
      "review-pagination-eligibility-response-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-1280",
      "review-pagination-eligibility-continuation-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-1280",
      "review-pagination-eligibility-flags-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-1280",
      "review-pagination-cursor-unavailable-invalidates-private-cache-and-recovers-only-with-explicit-current-base-get-1280",
      "voice-accumulated-review-confirm-context-and-canonical-propose-1280",
      "voice-delta-review-confirm-context-and-canonical-propose-1280",
      "voice-unknown-review-confirm-context-and-canonical-propose-1280",
      "voice-pending-review-confirm-context-and-canonical-propose-1280",
      "voice-malformed-review-confirm-context-and-canonical-propose-1280",
      "voice-task-changed-review-confirm-context-and-canonical-propose-1280",
      "voice-source-page-review-confirm-context-and-canonical-propose-1280",
      "voice-evidence-removed-review-confirm-context-and-canonical-propose-1280",
      "voice-context-review-confirm-context-and-canonical-propose-1280",
      "voice-conflict-review-confirm-context-and-canonical-propose-1280",
      "voice-denied-review-confirm-context-and-canonical-propose-1280",
      "review-pagination-home-open-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-1280",
      "review-pagination-home-draft-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-1280",
      "review-pagination-home-uncertain-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-1280",
      "review-pagination-home-media-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-1280",
      "review-pagination-home-gps-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-1280",
      "review-pagination-home-role-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-1280",
      "review-pagination-home-denied-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-1280",
      "review-pagination-home-stamp-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-1280",
      "review-pagination-home-flags-scoped-fresh-authority-pending-navigation-preserves-local-work-and-receipts-1280",
      "media-lease-live-reload-and-explicit-consent-respect-server-expiration-320",
      "media-lease-expired-reload-and-explicit-consent-respect-server-expiration-320",
      "media-lease-revoked-reload-and-explicit-consent-respect-server-expiration-320",
      "access-recovery-processing-clock-ahead-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-recovery-processing-expired-clock-behind-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "media-lease-live-reload-and-explicit-consent-respect-server-expiration-390",
      "media-lease-expired-reload-and-explicit-consent-respect-server-expiration-390",
      "media-lease-revoked-reload-and-explicit-consent-respect-server-expiration-390",
      "access-recovery-processing-clock-ahead-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-recovery-processing-expired-clock-behind-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "media-lease-live-reload-and-explicit-consent-respect-server-expiration-768",
      "media-lease-expired-reload-and-explicit-consent-respect-server-expiration-768",
      "media-lease-revoked-reload-and-explicit-consent-respect-server-expiration-768",
      "access-recovery-processing-clock-ahead-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-recovery-processing-expired-clock-behind-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "media-lease-live-reload-and-explicit-consent-respect-server-expiration-1280",
      "media-lease-expired-reload-and-explicit-consent-respect-server-expiration-1280",
      "media-lease-revoked-reload-and-explicit-consent-respect-server-expiration-1280",
      "access-recovery-processing-clock-ahead-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "access-recovery-processing-expired-clock-behind-retains-exact-private-attempt-requires-scoped-GET-before-replay",
      "video-audio-optin-explicit-scope-private-result-and-no-automatic-progress-320",
      "video-audio-decline-explicit-scope-private-result-and-no-automatic-progress-320",
      "video-audio-cancel-explicit-scope-private-result-and-no-automatic-progress-320",
      "video-audio-context-explicit-scope-private-result-and-no-automatic-progress-320",
      "video-audio-revoked-explicit-scope-private-result-and-no-automatic-progress-320",
      "video-audio-transcript-explicit-scope-private-result-and-no-automatic-progress-320",
      "video-audio-unconfirmed-explicit-scope-private-result-and-no-automatic-progress-320",
      "video-audio-no-track-explicit-scope-private-result-and-no-automatic-progress-320",
      "video-audio-silence-explicit-scope-private-result-and-no-automatic-progress-320",
      "video-audio-progress-approved-video-human-confirmation-current-task-cas-and-once-only-propose-320",
      "video-audio-visual-unconfirmed-extracted-frames-unconfirmed-vision-confirmed-transcript-and-no-automatic-progress-320",
      "video-audio-optin-explicit-scope-private-result-and-no-automatic-progress-390",
      "video-audio-decline-explicit-scope-private-result-and-no-automatic-progress-390",
      "video-audio-cancel-explicit-scope-private-result-and-no-automatic-progress-390",
      "video-audio-context-explicit-scope-private-result-and-no-automatic-progress-390",
      "video-audio-revoked-explicit-scope-private-result-and-no-automatic-progress-390",
      "video-audio-transcript-explicit-scope-private-result-and-no-automatic-progress-390",
      "video-audio-unconfirmed-explicit-scope-private-result-and-no-automatic-progress-390",
      "video-audio-no-track-explicit-scope-private-result-and-no-automatic-progress-390",
      "video-audio-silence-explicit-scope-private-result-and-no-automatic-progress-390",
      "video-audio-progress-approved-video-human-confirmation-current-task-cas-and-once-only-propose-390",
      "video-audio-visual-unconfirmed-extracted-frames-unconfirmed-vision-confirmed-transcript-and-no-automatic-progress-390",
      "video-audio-optin-explicit-scope-private-result-and-no-automatic-progress-768",
      "video-audio-decline-explicit-scope-private-result-and-no-automatic-progress-768",
      "video-audio-cancel-explicit-scope-private-result-and-no-automatic-progress-768",
      "video-audio-context-explicit-scope-private-result-and-no-automatic-progress-768",
      "video-audio-revoked-explicit-scope-private-result-and-no-automatic-progress-768",
      "video-audio-transcript-explicit-scope-private-result-and-no-automatic-progress-768",
      "video-audio-unconfirmed-explicit-scope-private-result-and-no-automatic-progress-768",
      "video-audio-no-track-explicit-scope-private-result-and-no-automatic-progress-768",
      "video-audio-silence-explicit-scope-private-result-and-no-automatic-progress-768",
      "video-audio-progress-approved-video-human-confirmation-current-task-cas-and-once-only-propose-768",
      "video-audio-visual-unconfirmed-extracted-frames-unconfirmed-vision-confirmed-transcript-and-no-automatic-progress-768",
      "video-audio-optin-explicit-scope-private-result-and-no-automatic-progress-1280",
      "video-audio-decline-explicit-scope-private-result-and-no-automatic-progress-1280",
      "video-audio-cancel-explicit-scope-private-result-and-no-automatic-progress-1280",
      "video-audio-context-explicit-scope-private-result-and-no-automatic-progress-1280",
      "video-audio-revoked-explicit-scope-private-result-and-no-automatic-progress-1280",
      "video-audio-transcript-explicit-scope-private-result-and-no-automatic-progress-1280",
      "video-audio-unconfirmed-explicit-scope-private-result-and-no-automatic-progress-1280",
      "video-audio-no-track-explicit-scope-private-result-and-no-automatic-progress-1280",
      "video-audio-silence-explicit-scope-private-result-and-no-automatic-progress-1280",
      "video-audio-progress-approved-video-human-confirmation-current-task-cas-and-once-only-propose-1280",
      "video-audio-visual-unconfirmed-extracted-frames-unconfirmed-vision-confirmed-transcript-and-no-automatic-progress-1280",
      "progress-self-review-own-proposal-needs-other-reviewer-and-canonical-rejection-does-not-lock-panel-320",
      "progress-self-review-stale-own-proposal-needs-other-reviewer-and-canonical-rejection-does-not-lock-panel-320",
      "progress-self-review-own-proposal-needs-other-reviewer-and-canonical-rejection-does-not-lock-panel-390",
      "progress-self-review-stale-own-proposal-needs-other-reviewer-and-canonical-rejection-does-not-lock-panel-390",
      "progress-self-review-own-proposal-needs-other-reviewer-and-canonical-rejection-does-not-lock-panel-768",
      "progress-self-review-stale-own-proposal-needs-other-reviewer-and-canonical-rejection-does-not-lock-panel-768",
      "progress-self-review-own-proposal-needs-other-reviewer-and-canonical-rejection-does-not-lock-panel-1280",
      "progress-self-review-stale-own-proposal-needs-other-reviewer-and-canonical-rejection-does-not-lock-panel-1280"
    ],
    "sourceFiles": [
      "src/app/(identity)/cuenta/field-operations-panel.js",
      "src/app/(identity)/cuenta/worksite-task-selector.js",
      "src/app/(identity)/cuenta/worksite-task-selector.module.css",
      "src/app/(identity)/cuenta/field-media-held-view.mjs",
      "src/app/(identity)/cuenta/voice-progress-draft-view.js",
      "src/app/(identity)/cuenta/field-review-page-view.mjs",
      "src/app/(identity)/cuenta/field-operations-panel.module.css",
      "src/app/(identity)/cuenta/field-overtime-view.js",
      "src/app/(identity)/cuenta/field-overtime-view.module.css",
      "src/app/(identity)/cuenta/field-qr-capture.js",
      "src/app/(identity)/cuenta/field-qr-reader.mjs",
      "src/app/(identity)/cuenta/field-media-capture.js",
      "src/app/(identity)/cuenta/field-media-preview.js",
      "src/app/(identity)/cuenta/field-media-preparation.mjs",
      "src/app/(identity)/cuenta/workspace-session-request.mjs",
      "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
      "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
      "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
      "src/app/(identity)/cuenta/participant-office-account-view.mjs",
      "src/app/(identity)/cuenta/own-company-number-view.mjs",
      "src/app/(identity)/cuenta/own-company-templates-view.mjs",
      "src/app/(identity)/cuenta/private-bank-account-format.mjs",
      "src/app/(identity)/cuenta/company-channel-view.mjs",
      "src/app/(identity)/cuenta/site-purchase-view.mjs",
      "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
      "src/app/(identity)/cuenta/private-workspace-download.js",
      "src/app/(identity)/cuenta/workspace-recovery-panel.js",
      "src/app/(identity)/cuenta/workspace.module.css",
      "src/app/(identity)/cuenta/template-send-view.mjs",
      "src/app/(identity)/cuenta/plan-baseline-view.mjs",
      "src/app/(identity)/cuenta/plan-source-curve.mjs",
      "src/lib/field-media-privacy.mjs",
      "src/lib/geo.js",
      "src/lib/field-media.mjs",
      "src/lib/field-operations-policy.mjs",
      "src/lib/field-operations-store.mjs",
      "src/lib/meta-cloud-protocol.mjs",
      "src/lib/private-image-upload.mjs",
      "src/lib/progress-measurement-quantity.js",
      "src/lib/site-register-policy.mjs",
      "src/lib/site-register-store.mjs",
      "src/lib/workspace-policy.mjs",
      "src/lib/voice-progress-draft.mjs",
      "src/lib/task-progress-measurement.js",
      "src/app/(identity)/cuenta/task-progress-measurement-view.mjs",
      "src/app/(identity)/cuenta/task-progress-measurement-editor.js",
      "src/app/(identity)/cuenta/task-progress-measurement-editor.module.css",
      "src/lib/plan-import-document-curve.mjs",
      "scripts/lib/plan-document-curve-fixture-copy.mjs"
    ],
    "focusedRunsAreNotFull": true
  },
  "nativeOrBrowserAcceptance": false
}); // REVIEWED_REVISION_DATA
function deepFreeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}}
deepFreeze(HOME_DECISIONS_CURRENT_REVISION);
const sha=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const safe=value=>typeof value==='string'&&/^(src|scripts|tests)\//.test(value)&&!value.includes('..')&&!value.includes('\\');
const reject=(ok,message)=>{if(!ok)throw Object.assign(new Error(message),{code:'HOME_DECISIONS_CURRENT_CI_LINEAGE_REJECTED'});};
const exact=(value,keys,message)=>reject(plain(value)&&same(Object.keys(value).sort(),keys.slice().sort()),message);
const actualRefs=(files,readSource)=>files.map(path=>{const bytes=readSource(path);reject(Buffer.isBuffer(bytes),'Missing actual observed source: '+path);return {path,sha256:sha(bytes)};});
const syntax=value=>Array.isArray(value)?value.map(syntax):plain(value)?Object.fromEntries(Object.entries(value).filter(([key])=>!['start','end','loc','extra','comments','leadingComments','innerComments','trailingComments'].includes(key)).map(([key,child])=>[key,syntax(child)])):value;
function section(contract){
 if(!plain(contract)||!Object.hasOwn(contract,HOME_DECISIONS_CURRENT_SECTION))return null;
 const value=contract[HOME_DECISIONS_CURRENT_SECTION];exact(value,[...Object.keys(HOME_DECISIONS_CURRENT_REVISION),'validationSources'],'Exact home decisions revision required');
 reject(value.status!=='PENDING','Home decisions sources have not been frozen');
 for(const[key,expected]of Object.entries(HOME_DECISIONS_CURRENT_REVISION))reject(same(value[key],expected),'Unreviewed home decisions declaration: '+key);
 reject(Array.isArray(value.validationSources)&&same(value.validationSources.map(row=>row?.path),[HOME_DECISIONS_CURRENT_HELPER,HOME_DECISIONS_CURRENT_TEST]),'Exact home decisions validator sources required');
 for(const row of value.validationSources){exact(row,['path','sha256'],'Exact home decisions validation reference required');reject(hash(row.sha256),'Home decisions source hash required');}
 return value;
}
function previousPaths(files,delta){
 reject(Array.isArray(files)&&files.every(file=>typeof file==='string')&&new Set(files).size===files.length&&same(files,[...files].sort())&&files.length===delta.currentCount&&sha(JSON.stringify(files))===delta.currentPathsSha256,'Exact current home decisions source set required: '+delta.family);
 const previous=files.filter(file=>!delta.additions.includes(file));
 reject(previous.length===delta.previousCount&&sha(JSON.stringify(previous))===delta.previousPathsSha256,'Exact home decisions predecessor source set required: '+delta.family);return previous;
}
export function restoreHomeDecisionsPreviousContract(contract){
 const value=section(contract);if(!value)return contract;
 const previous=structuredClone(contract);delete previous[HOME_DECISIONS_CURRENT_SECTION];
 for(const delta of value.proofProducerDeltas){
  const proofs=previous.extension?.proofs?.filter(row=>row.id===delta.id);reject(proofs?.length===1,'One exact home decisions producer proof required: '+delta.id);
  const proof=proofs[0];reject(proof.producer===delta.producer&&proof.path===delta.path&&proof.producerSha256===delta.currentProducerSha256,'Exact current home decisions proof producer required: '+delta.id);
  const records=previous.evidenceProducers?.filter(row=>row.path===delta.path&&row.producer===delta.producer);reject(records?.length===1&&records[0].producerSha256===delta.currentProducerSha256,'One exact current home decisions evidence producer required: '+delta.id);
  proof.producerSha256=delta.previousProducerSha256;records[0].producerSha256=delta.previousProducerSha256;
 }
 for(const delta of value.proofSourceDeltas){
  const proofs=previous.extension?.proofs?.filter(row=>row.id===delta.id);reject(proofs?.length===1,'One exact home decisions proof required: '+delta.id);
  const files=previousPaths(proofs[0].sourceFiles,delta);
  if(delta.id==='participant-kyc-preanalysis-postgres'){reject(same(previous.participantPreanalysisCurrentRevision.ciSourceFiles,proofs[0].sourceFiles),'Preanalysis current source declarations must agree');previous.participantPreanalysisCurrentRevision.ciSourceFiles=[...files];}
  proofs[0].sourceFiles=files;
 }
 reject(sha(JSON.stringify(previous,null,2)+'\n')===value.previousContractSha256,'The complete published 2b989846 contract must restore exactly');return previous;
}
export function homeDecisionsPreviousSourcePin(contract,ref){
 const value=section(contract),row=value&&[...value.reviewedSourceChanges,...value.validationDeltas].find(row=>row.path===ref.path);
 return row&&ref.sha256===row.currentSha256?row.previousSha256:ref.sha256;
}
export function homeDecisionsCurrentSourcePin(contract,ref){
 const value=section(contract),row=value&&[...value.reviewedSourceChanges,...value.validationDeltas].find(row=>row.path===ref.path);if(!row)return ref.sha256;
 reject([row.previousSha256,row.currentSha256].includes(ref.sha256),'Only exact authenticated home decisions predecessor or current pins may advance: '+ref.path);return row.currentSha256;
}
export function homeDecisionsValidationFiles(contract){
 const value=section(contract);if(!value)return[];restoreHomeDecisionsPreviousContract(contract);
 return [...new Set([...value.reviewedSourceChanges,...value.validationDeltas,...value.validationSources].map(row=>row.path))].sort();
}
// Only complete, reviewed AST nodes are projected. A changed identity guard,
// query, role expression or unrelated statement remains in the historical AST.
export function homeDecisionsLegacyOperationsAst(tree){
 const projection=HOME_DECISIONS_CURRENT_REVISION.operationsProjection;if(!projection)return tree;
 function project(node){
  if(Array.isArray(node))return node.map(project).filter(value=>value!==null);
  if(!plain(node))return node;
  const digest=sha(JSON.stringify(syntax(node)));
  if(projection.removedNodeSha256.includes(digest))return null;
  const replacement=projection.replacements.find(row=>row.currentNodeSha256===digest);if(replacement)return structuredClone(replacement.previousNode);
  return Object.fromEntries(Object.entries(node).map(([key,child])=>[key,project(child)]));
 }
 return project(tree);
}
export function verifyHomeDecisionsCurrentSources(contract,readSource){
 const value=section(contract);if(!value)return null;restoreHomeDecisionsPreviousContract(contract);reject(typeof readSource==='function','Actual home decisions source reader required');
 const refs=[...value.reviewedSourceChanges,...value.validationDeltas].map(row=>({path:row.path,sha256:row.currentSha256})).concat(value.validationSources);
 reject(new Set(refs.map(row=>row.path)).size===refs.length,'Unique home decisions current source references required');
 for(const row of refs){reject(safe(row.path)&&hash(row.sha256),'Safe exact home decisions source pin required');const bytes=readSource(row.path);reject(Buffer.isBuffer(bytes),'Missing current home decisions source: '+row.path);const text=bytes.toString('utf8');reject(bytes.equals(Buffer.from(text))&&sha(text.replaceAll('\r\n','\n'))===row.sha256,'Stale current home decisions source: '+row.path);}
 const tree=parse(readSource('src/lib/operations-status.mjs').toString('utf8'),{sourceType:'module'});
 reject(sha(JSON.stringify(syntax(homeDecisionsLegacyOperationsAst(tree))))===value.operationsProjection.previousAstSha256,'Every inherited operations-status authority and query must remain unchanged');
 return {version:1,completePreviousContractRestored:true,previousContractSha256:value.previousContractSha256,historicalPinsPreserved:true,nativeOrBrowserAcceptance:false};
}
export function restoreHomeDecisionsSourceSet(family,files,contract){
 const value=section(contract);if(!value)return files;restoreHomeDecisionsPreviousContract(contract);
 const delta=value.proofSourceDeltas.find(row=>row.family===family);return delta?previousPaths(files,delta):files;
}
export function homeDecisionsProofSourceAdditions(spec){
 const delta=HOME_DECISIONS_CURRENT_REVISION.proofSourceDeltas?.find(row=>row.id===spec?.id);if(!delta)return[];
 const files=spec.sourceFiles;reject(Array.isArray(files)&&new Set(files).size===files.length&&same(files,[...files].sort()),'Distinct sorted home decisions proof sources required');
 const count=files.length,digest=sha(JSON.stringify(files));if(count===delta.currentCount&&digest===delta.currentPathsSha256)return [...delta.additions];
 reject(delta.inheritedSets.some(row=>row.count===count&&row.pathsSha256===digest),'Unknown home decisions proof source set: '+delta.id);return[];
}
export function normalizeHomeDecisionsFocusedRaw(raw,{contract,readSource,readEvidence,directory}){
 const value=section(contract);if(!value)return raw;verifyHomeDecisionsCurrentSources(contract,readSource);
 const current=value.focusedUi;
 reject(plain(raw)&&raw.totalCheckCount===current.currentCheckNames.length&&raw.expectedTotalCheckCount===current.currentCheckNames.length&&Array.isArray(raw.checks)&&raw.checks.length===current.currentCheckNames.length,'All77 current home decisions browser observations required');
 reject(same(raw.checks.slice(current.previousCheckNames.length),current.addedCheckNames)&&same(raw.homeDecisionsWidths,current.widths)&&same(raw.homeDecisionsCheckLedger,current.addedCheckNames),'Exact18 additional home decisions observations and widths required');
 reject(Array.isArray(raw.requests)&&raw.requests.length===current.currentRequestCount,'Complete current home decisions request matrix required');
 const requests=raw.requests.map(row=>{
  reject(plain(row),'Actual current home decisions request facts required');const dynamic=row.mode==='wizard'&&row.method==='POST'?current.requestProjectionFieldsOmitted:[];
  reject(dynamic.every(key=>Object.hasOwn(row,key)),'Every original wizard correlation field is required');return Object.fromEntries(Object.entries(row).filter(([key])=>!dynamic.includes(key)));
 });
 reject(sha(JSON.stringify(requests))===current.currentRequestMatrixSha256,'Current home decisions request facts changed');
 reject(Array.isArray(raw.screenshots)&&same(raw.screenshots.map(row=>row?.path),current.screenshotNames),'Every inherited and home decisions screenshot required');
 for(const row of raw.screenshots.slice(current.previousScreenshotNames.length)){
  exact(row,['path','sha256','geometry'],'Exact home decisions screenshot required');exact(row.geometry,['width','height','scrollWidth','identityActionTop'],'Exact home decisions viewport required');
  const width=Number(/^home-pending-decisions-(320|390|768|1440)\.png$/.exec(row.path)?.[1]);
  reject(current.widths.includes(width)&&row.geometry.width===width&&row.geometry.height===1000&&Number.isSafeInteger(row.geometry.scrollWidth)&&row.geometry.scrollWidth>0&&row.geometry.scrollWidth<=width+1&&(row.geometry.identityActionTop===null||Number.isFinite(row.geometry.identityActionTop)),'Home decisions must fit every measured viewport');
  const bytes=readEvidence(directory+'/'+row.path);reject(Buffer.isBuffer(bytes)&&sha(bytes)===row.sha256,'Current home decisions screenshot bytes changed');
 }
 const previous={...raw,checks:raw.checks.slice(0,current.previousCheckNames.length),totalCheckCount:current.previousCheckNames.length,expectedTotalCheckCount:current.previousCheckNames.length,requests:current.previousRequestIndices.map(index=>raw.requests[index]),screenshots:raw.screenshots.slice(0,current.previousScreenshotNames.length)};
 delete previous.homeDecisionsWidths;delete previous.homeDecisionsCheckLedger;
 return previous;
}
export function validateHomeDecisionsNativeProof(proof,contract,readSource){
 const value=section(contract);if(!value)return null;verifyHomeDecisionsCurrentSources(contract,readSource);
 reject(plain(proof)&&proof.status==='PASS'&&proof.environment==='disposable-localhost-canonical-material-inventory'&&same(proof.checks,value.native.currentCheckNames)&&proof.checkCount===value.native.currentCheckNames.length&&proof.providerCalls===0&&proof.productionDataTouched===false&&proof.humanAccepted===false&&proof.newTables===false&&proof.participantKycFixture?.identityCertified===false&&proof.participantKycFixture.providerCalls===0,'Exact inherited23 plus one local home decisions PostgreSQL observation required');
 reject(same(proof.materialReviewQueue,value.native.previousMaterialReviewQueue)&&same(proof.homeDecisions,value.native.homeDecisions),'Every inherited material queue fact and new home decisions fact required');
 reject(proof.harnessSha256===sha(readSource(value.native.producer))&&same(proof.sourceManifest,actualRefs(value.native.sourceFiles,readSource)), 'Exact actual native source manifest and producer required');
 return {version:1,status:'PASS',historicalChecksPreserved:value.native.previousCheckNames.length,addedChecks:value.native.addedCheckNames.length,nativeOrBrowserAcceptance:false};
}
export function validateHomeDecisionsFieldProof(proof,contract,readSource){
 const value=section(contract);if(!value)return null;verifyHomeDecisionsCurrentSources(contract,readSource);
 reject(plain(proof)&&proof.status==='PASS'&&proof.environment==='actual-component-with-intercepted-synthetic-api'&&proof.fullSuite===true&&proof.focusedScenario===null&&same(proof.widths,[320,390,768,1280])&&same(proof.checks,value.fieldUi.currentCheckNames)&&proof.providerCalls===0&&proof.metaMessagesSent===0&&proof.productionDataWritten===false&&proof.physicalGeolocationAccepted===false&&proof.cameraQrAccepted===false&&proof.physicalCameraAccepted===false&&proof.physicalMicrophoneAccepted===false&&!Object.hasOwn(proof,'humanAccepted')&&same(proof.errors,[]),'The complete field browser run is required; focused observations cannot replace FULL or claim physical acceptance');
 reject(proof.harnessSha256===sha(readSource(value.fieldUi.producer))&&same(proof.sourceManifest,actualRefs(value.fieldUi.sourceFiles,readSource)), 'Exact actual field source manifest and producer required');
 return {version:1,status:'PASS',historicalChecksPreserved:value.fieldUi.previousCheckNames.length,addedChecks:value.fieldUi.addedCheckNames.length,nativeOrBrowserAcceptance:false};
}
