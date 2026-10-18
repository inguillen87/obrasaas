import {WORKSITE_LIVE_HOURS_CURRENT_SECTION,restoreWorksiteLiveHoursPreviousContract as worksiteOuter0,worksiteLiveHoursCurrentSourcePin as worksiteOuter1,worksiteLiveHoursPreviousSourcePin as worksiteOuter2,restoreWorksiteLiveHoursSourceSet as worksiteOuter3,verifyWorksiteLiveHoursCurrentSources as worksiteOuter4,worksiteLiveHoursProofSourceAdditions as worksiteOuter5,restoreWorksiteLiveHoursPreviousProducerText as worksiteOuter6,worksiteLiveHoursValidationFiles as worksiteOuter7} from './worksite-live-hours-current-ci-lineage.mjs';
import {PLAN_PARTIDA_PREVIEW_CURRENT_REVISION,verifyPlanPartidaPreviewCurrentSources,validatePlanPartidaPreviewUiSupplement} from './plan-partida-preview-current-ci-lineage.mjs';
// Preserve this consumer's established denial category at the outer revision boundary.
function homeWorksiteOuterCall(fn,args){try{return fn(...args);}catch(error){if(error.code==='WORKSITE_LIVE_HOURS_CURRENT_CI_LINEAGE_REJECTED')reject(false,error.message);throw error;}}
const restoreWorksiteLiveHoursPreviousContract=(...args)=>homeWorksiteOuterCall(worksiteOuter0,args);
const worksiteLiveHoursCurrentSourcePin=(...args)=>homeWorksiteOuterCall(worksiteOuter1,args);
const worksiteLiveHoursPreviousSourcePin=(...args)=>homeWorksiteOuterCall(worksiteOuter2,args);
const restoreWorksiteLiveHoursSourceSet=(...args)=>homeWorksiteOuterCall(worksiteOuter3,args);
const verifyWorksiteLiveHoursCurrentSources=(...args)=>homeWorksiteOuterCall(worksiteOuter4,args);
const worksiteLiveHoursProofSourceAdditions=(...args)=>homeWorksiteOuterCall(worksiteOuter5,args);
const restoreWorksiteLiveHoursPreviousProducerText=(...args)=>homeWorksiteOuterCall(worksiteOuter6,args);
const worksiteLiveHoursValidationFiles=(...args)=>homeWorksiteOuterCall(worksiteOuter7,args);
import path from 'node:path';
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
      "path": "tests/production-plan-measurement-document-association-ci-lineage.test.mjs",
      "previousSha256": "6e1424a595ed5be8ee7111a4aa0edc031e10678f8da0ec2c337cd9d9da2281cd",
      "currentSha256": "4145a4398f3c4b4c4d1226983cbf8d95313c8c7f5e59ec544b897344f794fb91"
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
export const CUSTOMER_PHONE_SELECTION_CURRENT_SECTION='customerPhoneSelectionCurrentRevision';
export const CUSTOMER_PHONE_SELECTION_CURRENT_REVISION=Object.freeze({
  "version": 1,
  "status": "REVIEWED_CUSTOMER_BUSINESS_APP_PHONE_SELECTION",
  "predecessorCommit": "8599969a1072c9b8e1afac0640df6a69219968b3",
  "previousContractSha256": "d3e0a5af11643ad3b5fb3c3ebb046edfc6f796a0142b23e1b604d0b15c14d5cb",
  "reviewedSourceChanges": [
    {
      "path": "scripts/verify-meta-customer-coexistence-postgres.mjs",
      "previousSha256": "20aae77b10b62c5bbdddb2d4568177bd51052a1272621ea78ecea6a3a1a8773e",
      "currentSha256": "fd94401af9a07866a2cd28a355b7f2f69ef122cf3ae325690c8ffc35cb97092a"
    },
    {
      "path": "src/lib/meta-customer-onboarding.mjs",
      "previousSha256": "4f8cd0f93a731871444d3f6d5d2c39285c84641b1141bc83b708cec1483306d8",
      "currentSha256": "6c0a115998d6e46236dcb70c3753c80f1559fec88de7735f122f157adc9530b8"
    },
    {
      "path": "src/lib/meta-customer-provider.mjs",
      "previousSha256": "131ddc2c6344bc1e58a6ea17aa665f9e8585a0aabee7300eaa050c06ab85470a",
      "currentSha256": "b6cc572fb68ab4cb653ccee30cea754a6273b5631d13e61dd2c2f65535aa287f"
    }
  ],
  "validationPredecessors": [
    {
      "path": "scripts/lib/home-decisions-current-ci-lineage.mjs",
      "sha256": "c2c4b99966b8983d49673f0623e7a0cf6983ae9de143dc90704126c803cd7009"
    },
    {
      "path": "scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs",
      "sha256": "f7e4779963eed7cd0442f7e4a9ebc56a75543fae1e69f9ad6214e18af1b04bfc"
    },
    {
      "path": "tests/production-home-decisions-current-ci-lineage.test.mjs",
      "sha256": "066887a5225fc53e2c9d6dd5d35512dc5b640fdb29cdbbb34e52e606775013f9"
    },
    {
      "path": "tests/production-meta-existing-api-plan-current-ci-lineage.test.mjs",
      "sha256": "b321b7dfb5c82333883f2008b5dfe9e00b6d8aba31c920bd3484e397bf5dd1ed"
    }
  ],
  "native": {
    "producer": "scripts/verify-meta-customer-coexistence-postgres.mjs",
    "previousCheckCount": 41,
    "currentCheckCount": 52,
    "previousCheckNamesSha256": "2ae29a080a935b03e965c7e3e92169b9e8ca61f411534c9862d0f33c17998509",
    "currentCheckNamesSha256": "017a754bed3aba7d628c453bbe3dd2ac2bc39d7340d6452cdf6941c6f6d5bc6c",
    "addedCheckNames": [
      "native-provider-WABA-only-multipage-uses-sealed-company-phone-exactly-once-without-register-or-activation",
      "native-provider-declaration-change-during-GET-denies-binding-and-POST-then-explicit-current-revision-recovers-same-grant-and-escrow-with-GET-only-receipt",
      "native-provider-explicit-wrong-ID-cannot-be-replaced-by-matching-alternate-number-or-dispatch-subscription",
      "native-provider-legacy-existing-credential-race-during-catalog-GET-preserves-current-connection-and-dispatches-no-POST",
      "native-provider-tenant-revocation-during-catalog-GET-denies-binding-and-subscription-with-durable-grant-reference",
      "native-provider-61-second-same-lease-expiry-before-binding-stops-all-effects-and-explicit-reconcile-recovers-identical-escrow-without-code-exchange",
      "native-provider-existing-credential-change-after-binding-commit-is-fenced-before-subscribe-with-legacy-declaration-absent",
      "native-provider-lease-expiry-after-binding-commit-prevents-subscription-and-keeps-disabled-binding-for-review",
      "native-provider-expired-inspection-loses-to-explicit-reclaimer-and-cannot-bind-subscribe-or-overwrite-the-newer-lease-result",
      "native-provider-real-binding-advisory-lock-crosses-lease-denies-bind-and-POST-preserves-grant-and-explicitly-recovers-without-exchange",
      "native-provider-real-existing-connection-row-lock-crosses-lease-denies-POST-preserves-provider-and-explicitly-recovers-same-escrow-without-exchange"
    ]
  },
  "nativeOrBrowserAcceptance": false
}); // PHONE_SELECTION_REVIEWED_REVISION_DATA
export const PARTICIPANT_DRAFT_SAFETY_CURRENT_SECTION='participantDraftSafetyCurrentRevision';
export const PARTICIPANT_DRAFT_SAFETY_CURRENT_REVISION=Object.freeze({
  "version": 1,
  "status": "REVIEWED_PARTICIPANT_DRAFT_SELECTION_AND_REVISION_RECOVERY",
  "predecessorCommit": "9b26ac5f78ee469b4a61d83018b1ea98fb73aa3e",
  "previousContractSha256": "42ced37df92bfaa681e0844ba23839bf8630a0d00404415aeb5dbca77238c27e",
  "reviewedSourceChanges": [
    {
      "path": "src/app/(identity)/cuenta/participant-panel.js",
      "previousSha256": "d16ee3ba394be011c5d338599d01653eec7d462705a2414821e02db3b44e38aa",
      "currentSha256": "a9d5934c7bda61c49362ac53cfb339a5d66497566f71415ecc4621686ce17519",
      "authenticatedPreviousAliases": [
        "4e10ff5f05942b9704f247e13972968cc2a441b6ba09bca277694e85a94cd56e"
      ]
    },
    {
      "path": "scripts/verify-participants-ui.mjs",
      "previousSha256": "77e5e12f6d5de2512e1f54d0cb0a45131355245ad1cd2e1b26b2b7d804d18ef9",
      "currentSha256": "06b9708236f65daa7af76ad284f03f0dfa0d56454e98206ee9bd24a9e64df976"
    },
    {
      "path": "scripts/verify-participant-kyc-chat-closure-ui.mjs",
      "previousSha256": "ab94c5a5ee387ce6cf9eb99bc3018e22b5485c2bd228c3ac10acfd014def5752",
      "currentSha256": "7922adb699d783b231952aeba405d1845f0f4699c4d14c626ce7bf3b04efe412"
    }
  ],
  "validationPredecessors": [
    {
      "path": "scripts/lib/home-decisions-current-ci-lineage.mjs",
      "sha256": "463cac0a3406559db5ceca581e035cf1c1bd20b0e8c9c85f6323c524a1ae4ea1"
    },
    {
      "path": "tests/production-home-decisions-current-ci-lineage.test.mjs",
      "sha256": "f07e9dd108fb478608ff6e42f3a1f9a954e49a028cfdfd993c4dcbbc722fc97f"
    }
  ],
  "fixtureSourceDeltas": [
    {
      "producer": "scripts/verify-participants-ui.mjs",
      "additions": [
        "src/app/(identity)/cuenta/participant-kyc-capture.js",
        "src/app/(identity)/cuenta/participant-kyc-capture.module.css",
        "src/app/(identity)/cuenta/participant-kyc-preanalysis-view.mjs"
      ]
    },
    {
      "producer": "scripts/verify-participant-kyc-chat-closure-ui.mjs",
      "additions": [
        "src/app/(identity)/cuenta/participant-kyc-capture.js",
        "src/app/(identity)/cuenta/participant-kyc-capture.module.css",
        "src/app/(identity)/cuenta/participant-kyc-preanalysis-view.mjs"
      ]
    }
  ],
  "sourceSetChanges": 0,
  "nativeOrBrowserAcceptance": false
}); // PARTICIPANT_DRAFT_SAFETY_REVIEWED_REVISION_DATA
function deepFreeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}}
deepFreeze(HOME_DECISIONS_CURRENT_REVISION);
deepFreeze(CUSTOMER_PHONE_SELECTION_CURRENT_REVISION);
deepFreeze(PARTICIPANT_DRAFT_SAFETY_CURRENT_REVISION);
const sha=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const safe=value=>typeof value==='string'&&/^(src|scripts|tests)\//.test(value)&&!value.includes('..')&&!value.includes('\\');
const reject=(ok,message)=>{if(!ok)throw Object.assign(new Error(message),{code:'HOME_DECISIONS_CURRENT_CI_LINEAGE_REJECTED'});};
const exact=(value,keys,message)=>reject(plain(value)&&same(Object.keys(value).sort(),keys.slice().sort()),message);
const actualRefs=(files,readSource)=>files.map(path=>{const bytes=readSource(path);reject(Buffer.isBuffer(bytes),'Missing actual observed source: '+path);return {path,sha256:sha(bytes)};});
const syntax=value=>Array.isArray(value)?value.map(syntax):plain(value)?Object.fromEntries(Object.entries(value).filter(([key])=>!['start','end','loc','extra','comments','leadingComments','innerComments','trailingComments'].includes(key)).map(([key,child])=>[key,syntax(child)])):value;
function participantDraftSafetySection(contract){
 if(!plain(contract)||!Object.hasOwn(contract,PARTICIPANT_DRAFT_SAFETY_CURRENT_SECTION))return null;
 const value=contract[PARTICIPANT_DRAFT_SAFETY_CURRENT_SECTION];exact(value,[...Object.keys(PARTICIPANT_DRAFT_SAFETY_CURRENT_REVISION),'validationSources'],'Exact participant draft safety revision required');
 for(const[key,expected]of Object.entries(PARTICIPANT_DRAFT_SAFETY_CURRENT_REVISION))reject(same(value[key],expected),'Unreviewed participant draft safety declaration: '+key);
 reject(Array.isArray(value.validationSources)&&same(value.validationSources.map(row=>row?.path),value.validationPredecessors.map(row=>row.path)),'Exact participant draft safety validator sources required');
 for(const row of value.validationSources){exact(row,['path','sha256'],'Exact participant draft safety validator reference required');reject(hash(row.sha256),'Participant draft safety validator hash required');}
 return value;
}
export function restoreParticipantDraftSafetyPreviousContract(contract){
 contract=restoreCompanyOnboardingUxPreviousContract(contract);
 const value=participantDraftSafetySection(contract);if(!value)return contract;
 const previous=structuredClone(contract);delete previous[PARTICIPANT_DRAFT_SAFETY_CURRENT_SECTION];
 reject(sha(JSON.stringify(previous,null,2)+'\n')===value.previousContractSha256,'The complete published9b26ac5f contract must restore exactly');return previous;
}
function participantDraftSafetyReferences(value){return [...value.reviewedSourceChanges,...value.validationPredecessors.map(previous=>({path:previous.path,previousSha256:previous.sha256,currentSha256:value.validationSources.find(row=>row.path===previous.path).sha256}))];}
export function participantDraftSafetyCurrentSourcePin(contract,ref){
 ref={...ref,sha256:companyOnboardingUxPreviousSourcePin(contract,ref)};
 const value=participantDraftSafetySection(contract);if(!value)return companyOnboardingUxCurrentSourcePin(contract,ref);
 const row=participantDraftSafetyReferences(value).find(row=>row.path===ref.path);if(!row)return companyOnboardingUxCurrentSourcePin(contract,ref);
 reject([row.previousSha256,row.currentSha256,...(row.authenticatedPreviousAliases||[])].includes(ref.sha256),'Only exact authenticated participant draft predecessor or current pins may advance: '+ref.path);return companyOnboardingUxCurrentSourcePin(contract,{...ref,sha256:row.currentSha256});
}
export function participantDraftSafetyPreviousSourcePin(contract,ref){
 ref={...ref,sha256:companyOnboardingUxPreviousSourcePin(contract,ref)};
 const value=participantDraftSafetySection(contract);if(!value)return ref.sha256;
 const row=participantDraftSafetyReferences(value).find(row=>row.path===ref.path);return row&&ref.sha256===row.currentSha256?row.previousSha256:ref.sha256;
}
export function verifyParticipantDraftSafetyCurrentSources(contract,readSource){
 const value=participantDraftSafetySection(contract);if(!value)return null;restoreParticipantDraftSafetyPreviousContract(contract);reject(typeof readSource==='function','Actual participant draft safety source reader required');
 const refs=participantDraftSafetyReferences(value);
 reject(new Set(refs.map(row=>row.path)).size===refs.length,'Unique participant draft safety source references required');
 for(const row of refs){reject(safe(row.path)&&hash(row.previousSha256)&&hash(row.currentSha256),'Safe exact participant draft safety source pin required');const bytes=readSource(row.path);reject(Buffer.isBuffer(bytes),'Missing current participant draft safety source: '+row.path);const text=bytes.toString('utf8');reject(bytes.equals(Buffer.from(text))&&sha(text.replaceAll('\r\n','\n'))===companyOnboardingUxCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}),'Stale current participant draft safety source: '+row.path);}
 return {version:1,completePreviousContractRestored:true,previousContractSha256:value.previousContractSha256,historicalPinsPreserved:true,sourceSetChanges:0,nativeOrBrowserAcceptance:false};
}
// Global consumers retain their existing source closures. Integrated already
// reads the participant panel; the explicit UI verifier also reads both harnesses.
function phoneSelectionSection(contract){
 if(!plain(contract)||!Object.hasOwn(contract,CUSTOMER_PHONE_SELECTION_CURRENT_SECTION))return null;
 const value=contract[CUSTOMER_PHONE_SELECTION_CURRENT_SECTION];exact(value,[...Object.keys(CUSTOMER_PHONE_SELECTION_CURRENT_REVISION),'validationSources'],'Exact customer phone selection revision required');
 for(const[key,expected]of Object.entries(CUSTOMER_PHONE_SELECTION_CURRENT_REVISION))reject(same(value[key],expected),'Unreviewed customer phone selection declaration: '+key);
 reject(Array.isArray(value.validationSources)&&same(value.validationSources.map(row=>row?.path),value.validationPredecessors.map(row=>row.path)),'Exact customer phone selection validator sources required');
 for(const row of value.validationSources){exact(row,['path','sha256'],'Exact customer phone selection validator reference required');reject(hash(row.sha256),'Customer phone selection validator hash required');}
 return value;
}
export function restoreCustomerPhoneSelectionPreviousContract(contract){
 contract=restoreParticipantDraftSafetyPreviousContract(contract);
 const value=phoneSelectionSection(contract);if(!value)return contract;
 const previous=structuredClone(contract);delete previous[CUSTOMER_PHONE_SELECTION_CURRENT_SECTION];
 reject(sha(JSON.stringify(previous,null,2)+'\n')===value.previousContractSha256,'The complete published8599969 contract must restore exactly');return previous;
}
function phoneSelectionReferences(value){return [...value.reviewedSourceChanges,...value.validationPredecessors.map(previous=>({path:previous.path,previousSha256:previous.sha256,currentSha256:value.validationSources.find(row=>row.path===previous.path).sha256}))];}
export function customerPhoneSelectionCurrentSourcePin(contract,ref){
 ref={...ref,sha256:participantDraftSafetyPreviousSourcePin(contract,ref)};
 const value=phoneSelectionSection(contract);if(!value)return participantDraftSafetyCurrentSourcePin(contract,ref);
 const row=phoneSelectionReferences(value).find(row=>row.path===ref.path);if(!row)return participantDraftSafetyCurrentSourcePin(contract,ref);
 reject([row.previousSha256,row.currentSha256].includes(ref.sha256),'Only exact authenticated8599969 or current phone selection pins may advance: '+ref.path);return participantDraftSafetyCurrentSourcePin(contract,{...ref,sha256:row.currentSha256});
}
export function customerPhoneSelectionPreviousSourcePin(contract,ref){
 ref={...ref,sha256:participantDraftSafetyPreviousSourcePin(contract,ref)};
 const value=phoneSelectionSection(contract);if(!value)return ref.sha256;
 const row=phoneSelectionReferences(value).find(row=>row.path===ref.path);if(!row)return ref.sha256;
 return ref.sha256===row.currentSha256?row.previousSha256:ref.sha256;
}
export function customerPhoneSelectionValidationFiles(contract){
 const value=phoneSelectionSection(contract);if(!value)return[];restoreCustomerPhoneSelectionPreviousContract(contract);return phoneSelectionReferences(value).map(row=>row.path).sort();
}
export function verifyCustomerPhoneSelectionCurrentSources(contract,readSource){
 const value=phoneSelectionSection(contract);if(!value)return null;restoreCustomerPhoneSelectionPreviousContract(contract);reject(typeof readSource==='function','Actual customer phone selection source reader required');
 const refs=phoneSelectionReferences(value);reject(new Set(refs.map(row=>row.path)).size===refs.length,'Unique customer phone selection references required');
 for(const row of refs){reject(safe(row.path)&&hash(row.previousSha256)&&hash(row.currentSha256),'Safe exact customer phone selection source pin required');const bytes=readSource(row.path);reject(Buffer.isBuffer(bytes),'Missing current customer phone selection source: '+row.path);const text=bytes.toString('utf8');reject(bytes.equals(Buffer.from(text))&&sha(text.replaceAll('\r\n','\n'))===participantDraftSafetyCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}),'Stale current customer phone selection source: '+row.path);}
 return {version:1,completePreviousContractRestored:true,previousContractSha256:value.previousContractSha256,historicalPinsPreserved:true,nativeOrBrowserAcceptance:false};
}
export function normalizeCustomerPhoneSelectionNativeProof(proof,contract,readSource){
 const value=phoneSelectionSection(contract);if(!value)return proof;verifyCustomerPhoneSelectionCurrentSources(contract,readSource);
 const previous=restoreCustomerPhoneSelectionPreviousContract(contract),historical=previous.existingApiPlanCurrentRevision?.native?.currentCheckNames;
 reject(Array.isArray(historical)&&historical.length===value.native.previousCheckCount&&sha(JSON.stringify(historical))===value.native.previousCheckNamesSha256,'Exact41 historical API plan controls required');
 const complete=[...historical,...value.native.addedCheckNames];
 reject(complete.length===value.native.currentCheckCount&&new Set(value.native.addedCheckNames).size===value.native.addedCheckNames.length&&value.native.addedCheckNames.every(name=>!historical.includes(name))&&sha(JSON.stringify(complete))===value.native.currentCheckNamesSha256,'Exact additive customer phone selection controls required');
 reject(plain(proof)&&proof.status==='PASS'&&proof.environment==='local-disposable-postgresql17'&&same(proof.checks,complete)&&proof.realProviderCalls===0&&proof.physicalNumberTested===false&&proof.productionDataTouched===false,'All52 native observations including all11 new controls are required without provider or human acceptance');
 return {...proof,checks:[...historical]};
}
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
 contract=restoreCustomerPhoneSelectionPreviousContract(contract);
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
 ref={...ref,sha256:customerPhoneSelectionPreviousSourcePin(contract,ref)};
 const value=section(contract),row=value&&[...value.reviewedSourceChanges,...value.validationDeltas].find(row=>row.path===ref.path);
 return row&&ref.sha256===row.currentSha256?row.previousSha256:ref.sha256;
}
export function homeDecisionsCurrentSourcePin(contract,ref){
 ref={...ref,sha256:customerPhoneSelectionPreviousSourcePin(contract,ref)};
 const value=section(contract),row=value&&[...value.reviewedSourceChanges,...value.validationDeltas].find(row=>row.path===ref.path);if(!row)return customerPhoneSelectionCurrentSourcePin(contract,ref);
 reject([row.previousSha256,row.currentSha256].includes(ref.sha256),'Only exact authenticated home decisions predecessor or current pins may advance: '+ref.path);return customerPhoneSelectionCurrentSourcePin(contract,{...ref,sha256:row.currentSha256});
}
export function homeDecisionsValidationFiles(contract){
 const value=section(contract);if(!value)return[];restoreHomeDecisionsPreviousContract(contract);
 const destination=identityDestinationUxSection(contract),wait=progressEvidenceWaitSection(contract),weekly=weeklyCypSection(contract);return [...new Set([...worksiteLiveHoursValidationFiles(contract),...(destination?identityDestinationUxReferences(destination).map(row=>row.path):[]),...(wait?wait.reviewedSourceChanges.map(row=>row.path):[]),...customerPhoneSelectionValidationFiles(contract),...(weekly?['scripts/lib/plan-document-curve-fixture-copy.mjs',...weekly.validationSources.map(row=>row.path)]:[]),...[...value.reviewedSourceChanges,...value.validationDeltas,...value.validationSources].map(row=>row.path)])].sort();
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
 verifyWeeklyCypCurrentSources(contract,readSource);
 verifyCompanyOnboardingUxValidationSources(contract,readSource);
 verifyCustomerPhoneSelectionCurrentSources(contract,readSource);
 const value=section(contract);if(!value)return null;restoreHomeDecisionsPreviousContract(contract);reject(typeof readSource==='function','Actual home decisions source reader required');
 const refs=[...value.reviewedSourceChanges,...value.validationDeltas].map(row=>({path:row.path,sha256:row.currentSha256})).concat(value.validationSources);
 reject(new Set(refs.map(row=>row.path)).size===refs.length,'Unique home decisions current source references required');
 for(const row of refs){reject(safe(row.path)&&hash(row.sha256),'Safe exact home decisions source pin required');const bytes=readSource(row.path);reject(Buffer.isBuffer(bytes),'Missing current home decisions source: '+row.path);const text=bytes.toString('utf8');reject(bytes.equals(Buffer.from(text))&&sha(text.replaceAll('\r\n','\n'))===customerPhoneSelectionCurrentSourcePin(contract,row),'Stale current home decisions source: '+row.path);}
 const tree=parse(readSource('src/lib/operations-status.mjs').toString('utf8'),{sourceType:'module'});
 reject(sha(JSON.stringify(syntax(homeDecisionsLegacyOperationsAst(tree))))===value.operationsProjection.previousAstSha256,'Every inherited operations-status authority and query must remain unchanged');
 return {version:1,completePreviousContractRestored:true,previousContractSha256:value.previousContractSha256,historicalPinsPreserved:true,nativeOrBrowserAcceptance:false};
}
export function restoreHomeDecisionsSourceSet(family,files,contract){
 files=restoreIdentityDestinationUxSourceSet(family,files,contract);
 const weekly=weeklyCypSection(contract)?.proofSourceDeltas.find(row=>row.family===family);if(weekly)files=previousPaths(files,weekly);
 const value=section(contract);if(!value)return files;restoreHomeDecisionsPreviousContract(contract);
 const delta=value.proofSourceDeltas.find(row=>row.family===family);return delta?previousPaths(files,delta):files;
}
export function homeDecisionsProofSourceAdditions(spec){
 const outer=weeklyCypProofSourceAdditions(spec);if(outer.length)spec={...spec,sourceFiles:spec.sourceFiles.filter(file=>!outer.includes(file))};
 const delta=HOME_DECISIONS_CURRENT_REVISION.proofSourceDeltas?.find(row=>row.id===spec?.id);if(!delta)return outer;
 const files=spec.sourceFiles;reject(Array.isArray(files)&&new Set(files).size===files.length&&same(files,[...files].sort()),'Distinct sorted home decisions proof sources required');
 const count=files.length,digest=sha(JSON.stringify(files));if(count===delta.currentCount&&digest===delta.currentPathsSha256)return [...delta.additions,...outer];
 reject(delta.inheritedSets.some(row=>row.count===count&&row.pathsSha256===digest),'Unknown home decisions proof source set: '+delta.id);return outer;
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


// Native core observation boundary. The declaration is source-reviewed; this is
// local/synthetic evidence, never provider, identity or human acceptance.
export const COMPANY_ONBOARDING_UX_NATIVE_REVIEW=Object.freeze({
  "producer": "scripts/verify-company-channel-postgres.mjs",
  "producerLfSha256": "ae2031c88abba7716cd7a56afcb1546c4bf706d8381901c0c2272fb023866320",
  "historicalCheckCount": 45,
  "historicalChecksSha256": "4bf365631adfc58cf7e36d8178ae4683e4371edde67576d838cabcea4df4d34b",
  "historicalSupplementalCount": 4,
  "historicalSupplementalSha256": "05e2f22dbfc69aa78bc9ec5352d621d904f5e1e8cc81d0f7e4a8e9b5e768fa83",
  "currentSupplementalCount": 9,
  "currentSupplementalSha256": "e027afa8cb9854af0c0e35d500edc6aa00574fee6f62c08ebabed1cbdea94c88",
  "addedCheckNames": [
    "composed-import-APPLY-creates-one-real-Task-from-explicitly-deterministic-private-document-fixture",
    "composed-signed-company-photo-belongs-to-import-created-Task-and-canonical-independent-review-does-not-apply-progress",
    "composed-imported-Task-progress-is-APPLIED-by-distinct-authorized-actor-only-after-approved-linked-photo",
    "composed-same-imported-Task-consumption-is-APPROVED-and-one-canonical-OUT-movement-deducts-exact-1.001-kg",
    "composed-signed-source-command-and-status-replays-preserve-one-import-task-evidence-APPLIED-progress-APPROVED-consumption-and-stock-movement"
  ],
  "totalCheckCount": 54,
  "sourceCount": 238,
  "sourcePathsSha256": "2419e373bc9ca766076ae015bae3af9bb187a7df663a5cc82979990e5b5c2d61",
  "documentSourceSha256": "d0842da039e306f698aa237d476e93ace6c7cd88d90c2877beb1d6b6739b1385"
});
Object.freeze(COMPANY_ONBOARDING_UX_NATIVE_REVIEW.addedCheckNames);
function companyNativeRequired(ok,reason){if(!ok)throw Object.assign(new Error('Current company native proof rejected: '+reason),{code:'COMPANY_ONBOARDING_UX_NATIVE_PROOF_REJECTED',reason});}
function companyNativeKeys(value,keys,reason){companyNativeRequired(value!==null&&typeof value==='object'&&!Array.isArray(value)&&JSON.stringify(Object.keys(value).sort())===JSON.stringify(keys.slice().sort()),reason);}
const companyNativeSha=bytes=>createHash('sha256').update(bytes).digest('hex');
const companyNativeHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const companyNativeCount=value=>Number.isSafeInteger(value)&&value>=0;
const companyNativePattern=(pattern,value)=>typeof value==='string'&&pattern.test(value);
const companyNativeSourcePath=value=>typeof value==='string'&&/^(src|scripts|tests)\//.test(value)&&!value.includes('..')&&!value.includes('\\');
function companyNativeRead(readSource,file){let bytes;try{bytes=readSource(file);}catch{companyNativeRequired(false,'SOURCE_MISSING');}companyNativeRequired(Buffer.isBuffer(bytes),'SOURCE_MISSING');return bytes;}
export function validateCompanyOnboardingUxNativeProof(proof,readSource){
 const n=COMPANY_ONBOARDING_UX_NATIVE_REVIEW,r=companyNativeRequired,k=companyNativeKeys,contract=progressEvidenceWaitReaderContract(readSource),wait=progressEvidenceWaitSection(contract);
 k(proof,['version','at','status','participantKycFixture','disposableDatabase','production','provider','checks','checkCount','supplementalChecks','supplementalCheckCount','totalCheckCount','sourceEventsUnique','composedFieldCore','connections','sends','mediaIO','realMediaIO','harnessSha256','sourceManifest','databaseRemoved'],'PROOF_SHAPE');
 r(proof.version===1&&proof.status==='PASS'&&typeof proof.at==='string'&&Number.isFinite(Date.parse(proof.at))&&new Date(proof.at).toISOString()===proof.at,'PROOF_STATE');
 r(proof.disposableDatabase===true&&proof.databaseRemoved===true&&proof.production===false&&proof.provider==='controlled-synthetic-only'&&proof.sourceEventsUnique===true&&proof.connections===1&&companyNativeCount(proof.sends),'PROOF_LIMITS');
 r(Array.isArray(proof.checks)&&proof.checkCount===n.historicalCheckCount&&proof.checks.length===n.historicalCheckCount&&companyNativeSha(JSON.stringify(proof.checks))===n.historicalChecksSha256,'HISTORICAL_CHECKS');
 r(Array.isArray(proof.supplementalChecks)&&proof.supplementalCheckCount===n.currentSupplementalCount&&proof.supplementalChecks.length===n.currentSupplementalCount&&companyNativeSha(JSON.stringify(proof.supplementalChecks))===n.currentSupplementalSha256&&proof.totalCheckCount===n.totalCheckCount&&proof.totalCheckCount===proof.checkCount+proof.supplementalCheckCount,'SUPPLEMENTAL_CHECKS');
 const historical=proof.supplementalChecks.filter(name=>!n.addedCheckNames.includes(name));
 r(historical.length===n.historicalSupplementalCount&&companyNativeSha(JSON.stringify(historical))===n.historicalSupplementalSha256&&n.addedCheckNames.every(name=>proof.supplementalChecks.filter(value=>value===name).length===1),'HISTORICAL_SUPPLEMENTAL');
 k(proof.participantKycFixture,['records','syntheticPrivateCalls','providerCalls','biometricIdentityCertified'],'KYC_FIXTURE_SHAPE');
 r(proof.participantKycFixture.providerCalls===0&&proof.participantKycFixture.biometricIdentityCertified===false&&Array.isArray(proof.participantKycFixture.records)&&proof.participantKycFixture.records.length>0&&proof.participantKycFixture.records.every(row=>row&&row.identityCertified===false&&row.providerCalls===0),'KYC_FIXTURE_LIMITS');
 k(proof.participantKycFixture.syntheticPrivateCalls,['privatePuts','privateReads'],'PRIVATE_IO_SHAPE');r(Object.values(proof.participantKycFixture.syntheticPrivateCalls).every(companyNativeCount),'PRIVATE_IO');
 k(proof.mediaIO,['downloads','gets','puts','analyses'],'MEDIA_IO_SHAPE');r(Object.values(proof.mediaIO).every(companyNativeCount),'MEDIA_IO');
 // These Graph/CDN counters are controlled local HTTP parser observations.
 k(proof.realMediaIO,['graph','cdn'],'CONTROLLED_HTTP_SHAPE');r(Object.values(proof.realMediaIO).every(companyNativeCount),'CONTROLLED_HTTP');
 const c=proof.composedFieldCore;
 k(c,['version','status','execution','projectId','originChannelProjectId','taskId','document','evidence','progress','inventory','replays','limits'],'CORE_SHAPE');
 r(c.version===1&&c.status==='PASS'&&c.execution==='LOCAL_DISPOSABLE_POSTGRES_SYNTHETIC_CANONICAL_CHAIN'&&c.projectId==='project-c'&&c.originChannelProjectId==='project-a'&&c.projectId!==c.originChannelProjectId,'CORE_CONTEXT');
 r(typeof c.taskId==='string'&&/^task_[a-f0-9]{32}$/.test(c.taskId),'CORE_TASK_ID');
 k(c.document,['draftId','applyReceiptId','sourceSha256','contentType','analyzer','io'],'DOCUMENT_SHAPE');
 r(companyNativePattern(/^plan_draft_[a-f0-9]{64}$/,c.document.draftId)&&companyNativePattern(/^plan_receipt_[a-f0-9]{64}$/,c.document.applyReceiptId)&&c.document.sourceSha256===n.documentSourceSha256&&c.document.contentType==='application/pdf'&&c.document.analyzer==='synthetic-deterministic-composed-fixture','DOCUMENT');
 k(c.document.io,['puts','gets','analyses'],'DOCUMENT_IO_SHAPE');r(c.document.io.puts===1&&c.document.io.gets===2&&c.document.io.analyses===1,'DOCUMENT_IO');
 k(c.evidence,['id','sourceEventId','reviewReceiptId','taskId'],'EVIDENCE_SHAPE');
 r(companyNativePattern(/^evidence_[a-f0-9]{40}$/,c.evidence.id)&&companyNativePattern(/^customer_webhook_[a-f0-9]{64}$/,c.evidence.sourceEventId)&&companyNativePattern(/^field_[a-f0-9]{64}$/,c.evidence.reviewReceiptId)&&c.evidence.taskId===c.taskId,'EVIDENCE');
 k(c.progress,['proposalId','sourceEventId','receiptId','taskId','state','progress','submittedBy','reviewedBy',...(wait?['evidenceWait']:[])],'PROGRESS_SHAPE');
 if(wait)validateProgressEvidenceWaitCompanyFacts(c.progress.evidenceWait,c);
 r(companyNativePattern(/^proposal_[a-f0-9]{32}$/,c.progress.proposalId)&&companyNativePattern(/^customer_webhook_[a-f0-9]{64}$/,c.progress.sourceEventId)&&companyNativePattern(/^field_[a-f0-9]{64}$/,c.progress.receiptId)&&c.progress.taskId===c.taskId&&c.progress.state==='APPLIED'&&c.progress.progress===25&&c.progress.submittedBy==='person'&&c.progress.reviewedBy==='core-reviewer'&&c.progress.reviewedBy!==c.progress.submittedBy,'PROGRESS');
 k(c.inventory,['materialId','openingProposalId','openingReceiptId','consumptionId','sourceEventId','receiptId','taskId','state','movementId','movementCount','quantity','unit','balanceBefore','balanceAfter'],'INVENTORY_SHAPE');
 const i=c.inventory;
 r(companyNativePattern(/^material_[a-f0-9]{32}$/,i.materialId)&&companyNativePattern(/^stock_adjustment_[a-f0-9]{32}$/,i.openingProposalId)&&companyNativePattern(/^field_[a-f0-9]{64}$/,i.openingReceiptId)&&companyNativePattern(/^consumption_[a-f0-9]{32}$/,i.consumptionId)&&companyNativePattern(/^customer_webhook_[a-f0-9]{64}$/,i.sourceEventId)&&companyNativePattern(/^field_[a-f0-9]{64}$/,i.receiptId)&&companyNativePattern(/^inventory_move_[a-f0-9]{64}$/,i.movementId)&&i.taskId===c.taskId&&i.state==='APPROVED'&&i.movementCount===1,'INVENTORY');
 r(i.movementId==='inventory_move_'+companyNativeSha(JSON.stringify(['material-movement-v1',i.receiptId])),'MOVEMENT_RECEIPT_IDENTITY');
 r(i.quantity==='1.001'&&i.unit==='kg'&&i.balanceBefore==='10.001'&&i.balanceAfter==='9.000'&&BigInt(i.balanceBefore.replace('.',''))-BigInt(i.quantity.replace('.',''))===BigInt(i.balanceAfter.replace('.','')),'STOCK_EXACT');
 const events=[c.evidence.sourceEventId,c.progress.sourceEventId,i.sourceEventId],receipts=[c.document.applyReceiptId,c.evidence.reviewReceiptId,c.progress.receiptId,i.openingReceiptId,i.receiptId];
 r(new Set(events).size===events.length&&new Set(receipts).size===receipts.length,'SOURCE_AND_RECEIPT_IDENTITY');
 k(c.replays,['duplicateSources','commandReplays','statusRecovery','snapshotUnchanged'],'REPLAY_SHAPE');
 r(c.replays.duplicateSources===3&&c.replays.commandReplays===true&&c.replays.statusRecovery===true&&c.replays.snapshotUnchanged===true,'REPLAY_STABLE');
 const limits={syntheticIdentities:true,syntheticDocumentBytes:true,deterministicAnalyzer:true,syntheticPrivateMedia:true,canonicalReviewerCommandWithSyntheticSession:true,realProviderCalls:0,realModelCalls:0,realDevicePhoto:false,realDocumentRecognition:false,ganttUiValidated:false,realHumanKyc:false,production:false,realAcceptance:false};
 k(c.limits,Object.keys(limits),'CORE_LIMITS_SHAPE');r(Object.entries(limits).every(([key,value])=>c.limits[key]===value),'CORE_LIMITS');
 r(typeof readSource==='function','SOURCE_READER');
 const producer=companyNativeRead(readSource,n.producer),text=producer.toString('utf8');
 r(producer.equals(Buffer.from(text))&&companyNativeSha(text.replaceAll('\r\n','\n'))===progressEvidenceWaitCurrentSourcePin(contract,{path:n.producer,sha256:n.producerLfSha256})&&proof.harnessSha256===companyNativeSha(producer),'CURRENT_HARNESS');
 r(Array.isArray(proof.sourceManifest)&&proof.sourceManifest.length===n.sourceCount,'SOURCE_MANIFEST');
 const paths=[];
 for(const ref of proof.sourceManifest){k(ref,['path','sha256'],'SOURCE_REFERENCE');r(companyNativeSourcePath(ref.path)&&companyNativeHash(ref.sha256),'SOURCE_REFERENCE');paths.push(ref.path);r(companyNativeSha(companyNativeRead(readSource,ref.path))===ref.sha256,'SOURCE_HASH');}
 r(new Set(paths).size===paths.length&&companyNativeSha(JSON.stringify(paths.slice().sort()))===n.sourcePathsSha256,'SOURCE_SET');
 if(wait){try{verifyProgressEvidenceWaitCurrentSources(contract,readSource);}catch(error){if(error.code==='HOME_DECISIONS_CURRENT_CI_LINEAGE_REJECTED')r(false,'CURRENT_WAIT_SOURCES');throw error;}}
 return {status:'PASS',checks:n.totalCheckCount,coreChecks:n.addedCheckNames.length,sourceReferences:n.sourceCount,syntheticOnly:true,realAcceptance:false};
}
export function validateCompanyOnboardingUxNativeProofBytes(bytes,readSource){
 companyNativeRequired(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=512*1024,'PROOF_BYTES');
 const text=bytes.toString('utf8');companyNativeRequired(bytes.equals(Buffer.from(text)),'PROOF_UTF8');
 let proof;try{proof=JSON.parse(text);}catch{companyNativeRequired(false,'PROOF_JSON');}
 return validateCompanyOnboardingUxNativeProof(proof,readSource);
}

export const COMPANY_ONBOARDING_UX_CURRENT_SECTION='companyOnboardingUxCurrentRevision';
export const COMPANY_ONBOARDING_UX_CURRENT_REVISION=Object.freeze({
  "version": 1,
  "status": "REVIEWED_COMPANY_ONBOARDING_INFORMATION_AND_COMPOSED_FIELD_CORE",
  "predecessorCommit": "4f1b6df18e210a1be673c020a60274294d351e17",
  "previousContractSha256": "ecec0aa86b5826cdb38a75ff02803ae831479204e42bba97273c788b46ab834e",
  "reviewedSourceChanges": [
    {
      "path": "src/app/(identity)/cuenta/meta-onboarding-panel.js",
      "previousSha256": "6dd8eda06e40816270a707b01c71e468327c5659a480bce720d6db987893b57d",
      "currentSha256": "314f7b6b6e160a4c58f9f373ff6970d049ad4feefea7501a5d29ad4d63613af8"
    },
    {
      "path": "src/app/(identity)/cuenta/customer-whatsapp-panel.js",
      "previousSha256": "5186d11e95a8514e25d36d7157721f35627ce245476525295f62f05d0cc041ec",
      "currentSha256": "d129c4aa22e8048e03674382828222e5141e219f5d12368139a75ae735c9b247"
    },
    {
      "path": "src/app/(identity)/cuenta/company-channel-panel.js",
      "previousSha256": "41d778f1ead861ecb14020551079173dfe4b7cbaf89e7c158335b1156ed7d578",
      "currentSha256": "b41b9fd9a0fa16a25914b8d074ffbac1588b5d26dcca0310a8626ee211154a24"
    },
    {
      "path": "src/app/(identity)/cuenta/workspace-overview.js",
      "previousSha256": "1efd9a741ddd4e38492c38f62d95104a0a98c715a962df44aab0d1f793031b00",
      "currentSha256": "456e78d9e5c729182e65cd30141af37a5a6571d05261896ab5e19e39c4951c1b"
    },
    {
      "path": "scripts/verify-company-channel-ui.mjs",
      "previousSha256": "8fb58b5accb1f61f8862736f468a40bcd5e0b59be078f9468244dea6285095d6",
      "currentSha256": "06aa30e01daa873db935bf28856b17a4f17fb970cbc031649a392b66a5c05421"
    },
    {
      "path": "scripts/verify-focused-workspace-ui.mjs",
      "previousSha256": "fde529288d806f0aed540f155f4b7058485b7c6bcdfe8edddc607eb89b868cac",
      "currentSha256": "940bc05e5aa47d19e2251bc5559eed34e29275afff0d025f76f73a8fde41649f"
    },
    {
      "path": "scripts/verify-company-channel-postgres.mjs",
      "previousSha256": "21c273c25c315fdcacc05cfb16d528451f4caebb38eaf26aae0fd07887cc9e3b",
      "currentSha256": "ae2031c88abba7716cd7a56afcb1546c4bf706d8381901c0c2272fb023866320"
    }
  ],
  "validationPredecessors": [
    {
      "path": "scripts/lib/home-decisions-current-ci-lineage.mjs",
      "sha256": "cb2c1731ec5192786434fc4b905df6062068fde33c8f68719765a45c5dd02b3f"
    },
    {
      "path": "tests/production-home-decisions-current-ci-lineage.test.mjs",
      "sha256": "7a901da987b797dca7c8b574dc28ce300cb8839483c472f019e25d26dd914c84"
    },
    {
      "path": "tests/production-focused-workspace-task-pagination.test.mjs",
      "sha256": "058eb4f1ed8812e2b4d8341ea55bff8a98c22292153482260fdb9f0773398b35"
    }
  ],
  "focusedAssertions": {
    "previousCount": 201,
    "currentCount": 202,
    "previousAssertionsSha256": "3f44e2aad77a90668763e65989fee7a2f5637843da32c5482b4c7784824fc654",
    "start": 130,
    "previous": [
      "assert.ok(await item.page.$eval('[aria-labelledby=\"home-decisions-title\"]',node=>node.innerText.includes('hora de Argentina')))",
      "assert.equal(homeFacts(item).length,2,'Refresh dispatches one bounded GET even before React flushes')"
    ],
    "current": [
      "assert.ok(await item.page.$eval('[aria-labelledby=\"home-decisions-title\"]',node=>node.innerText.includes('hora de Argentina')&&node.innerText.includes('13:49:23')),'Home afternoon must use the Argentina h23 clock')",
      "assert.equal(homeFacts(item).length,2,'Refresh dispatches one bounded GET even before React flushes')",
      "assert.ok(await item.page.$eval('[aria-labelledby=\"home-decisions-title\"]',node=>node.innerText.includes('00:00:00')&&!node.innerText.includes('24:00:00')),'Home midnight must render 00:00 in Argentina')"
    ]
  },
  "native": {
    "producer": "scripts/verify-company-channel-postgres.mjs",
    "producerLfSha256": "ae2031c88abba7716cd7a56afcb1546c4bf706d8381901c0c2272fb023866320",
    "historicalCheckCount": 45,
    "historicalChecksSha256": "4bf365631adfc58cf7e36d8178ae4683e4371edde67576d838cabcea4df4d34b",
    "historicalSupplementalCount": 4,
    "historicalSupplementalSha256": "05e2f22dbfc69aa78bc9ec5352d621d904f5e1e8cc81d0f7e4a8e9b5e768fa83",
    "currentSupplementalCount": 9,
    "currentSupplementalSha256": "e027afa8cb9854af0c0e35d500edc6aa00574fee6f62c08ebabed1cbdea94c88",
    "addedCheckNames": [
      "composed-import-APPLY-creates-one-real-Task-from-explicitly-deterministic-private-document-fixture",
      "composed-signed-company-photo-belongs-to-import-created-Task-and-canonical-independent-review-does-not-apply-progress",
      "composed-imported-Task-progress-is-APPLIED-by-distinct-authorized-actor-only-after-approved-linked-photo",
      "composed-same-imported-Task-consumption-is-APPROVED-and-one-canonical-OUT-movement-deducts-exact-1.001-kg",
      "composed-signed-source-command-and-status-replays-preserve-one-import-task-evidence-APPLIED-progress-APPROVED-consumption-and-stock-movement"
    ],
    "totalCheckCount": 54,
    "sourceCount": 238,
    "sourcePathsSha256": "2419e373bc9ca766076ae015bae3af9bb187a7df663a5cc82979990e5b5c2d61",
    "documentSourceSha256": "d0842da039e306f698aa237d476e93ace6c7cd88d90c2877beb1d6b6739b1385"
  },
  "sourceSetChanges": 0,
  "nativeOrBrowserAcceptance": false
});
deepFreeze(COMPANY_ONBOARDING_UX_CURRENT_REVISION);

function companyOnboardingUxSection(contract){
 if(!plain(contract)||!Object.hasOwn(contract,COMPANY_ONBOARDING_UX_CURRENT_SECTION))return null;
 const value=contract[COMPANY_ONBOARDING_UX_CURRENT_SECTION];exact(value,[...Object.keys(COMPANY_ONBOARDING_UX_CURRENT_REVISION),'validationSources'],'Exact company onboarding UX revision required');
 for(const[key,expected]of Object.entries(COMPANY_ONBOARDING_UX_CURRENT_REVISION))reject(same(value[key],expected),'Unreviewed company onboarding UX declaration: '+key);
 reject(Array.isArray(value.validationSources)&&same(value.validationSources.map(row=>row?.path),value.validationPredecessors.map(row=>row.path)),'Exact company onboarding UX validator sources required');
 for(const row of value.validationSources){exact(row,['path','sha256'],'Exact company onboarding UX validator reference required');reject(hash(row.sha256),'Company onboarding UX validator hash required');}return value;
}
export function restoreCompanyOnboardingUxPreviousContract(contract){
 contract=restoreWeeklyCypPreviousContract(contract);
 const value=companyOnboardingUxSection(contract);if(!value)return contract;
 const previous=structuredClone(contract);delete previous[COMPANY_ONBOARDING_UX_CURRENT_SECTION];
 reject(sha(JSON.stringify(previous,null,2)+'\n')===value.previousContractSha256,'The complete published4f1 contract must restore exactly');return previous;
}
function companyOnboardingUxReferences(value){return [...value.reviewedSourceChanges,...value.validationPredecessors.map(previous=>({path:previous.path,previousSha256:previous.sha256,currentSha256:value.validationSources.find(row=>row.path===previous.path).sha256}))];}
export function companyOnboardingUxCurrentSourcePin(contract,ref){
 ref={...ref,sha256:weeklyCypPreviousSourcePin(contract,ref)};
 const value=companyOnboardingUxSection(contract);if(!value)return weeklyCypCurrentSourcePin(contract,ref);const row=companyOnboardingUxReferences(value).find(row=>row.path===ref.path);if(!row)return weeklyCypCurrentSourcePin(contract,ref);
 reject([row.previousSha256,row.currentSha256].includes(ref.sha256),'Only exact published4f1 and reviewed company onboarding UX pins may advance: '+ref.path);return weeklyCypCurrentSourcePin(contract,{...ref,sha256:row.currentSha256});
}
export function companyOnboardingUxPreviousSourcePin(contract,ref){
 ref={...ref,sha256:weeklyCypPreviousSourcePin(contract,ref)};
 const value=companyOnboardingUxSection(contract);if(!value)return ref.sha256;const row=companyOnboardingUxReferences(value).find(row=>row.path===ref.path);return row&&ref.sha256===row.currentSha256?row.previousSha256:ref.sha256;
}
function verifyCompanyOnboardingUxRefs(refs,readSource,contract){
 reject(typeof readSource==='function','Actual company onboarding UX source reader required');
 for(const row of refs){const bytes=readSource(row.path);reject(Buffer.isBuffer(bytes),'Missing current company onboarding UX source: '+row.path);const text=bytes.toString('utf8');reject(bytes.equals(Buffer.from(text))&&sha(text.replaceAll('\r\n','\n'))===weeklyCypCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}),'Stale current company onboarding UX source: '+row.path);}
}
function verifyCompanyOnboardingUxValidationSources(contract,readSource){
 const value=companyOnboardingUxSection(contract);if(!value)return null;restoreCompanyOnboardingUxPreviousContract(contract);
 verifyCompanyOnboardingUxRefs(companyOnboardingUxReferences(value).filter(row=>value.validationSources.some(v=>v.path===row.path)),readSource,contract);return value;
}
export function verifyCompanyOnboardingUxCurrentSources(contract,readSource){
 verifyWeeklyCypCurrentSources(contract,readSource);
 const value=companyOnboardingUxSection(contract);if(!value)return null;restoreCompanyOnboardingUxPreviousContract(contract);verifyCompanyOnboardingUxRefs(companyOnboardingUxReferences(value),readSource,contract);
 return {version:1,completePreviousContractRestored:true,previousContractSha256:value.previousContractSha256,historicalPinsPreserved:true,sourceSetChanges:0,nativeOrBrowserAcceptance:false};
}
export function companyOnboardingUxHistoricalFocusedAssertions(source,contract){
 const value=companyOnboardingUxSection(contract);reject(value,'Reviewed company onboarding UX revision required');restoreCompanyOnboardingUxPreviousContract(contract);
 const file='scripts/verify-focused-workspace-ui.mjs',pin=value.reviewedSourceChanges.find(row=>row.path===file),text=Buffer.isBuffer(source)?source.toString('utf8'):source;
 reject(typeof text==='string'&&sha(text.replaceAll('\r\n','\n'))===pin.currentSha256,'Exact reviewed focused producer bytes required');
 const calls=[];function walk(node){if(!node||typeof node!=='object')return;if(node.type==='CallExpression'&&node.callee.type==='MemberExpression'&&node.callee.object?.name==='assert')calls.push(text.slice(node.start,node.end).replaceAll('\r\n','\n'));for(const child of Object.values(node))if(Array.isArray(child))child.forEach(walk);else if(child&&typeof child==='object')walk(child);}walk(parse(text,{sourceType:'module'}).program);
 const p=value.focusedAssertions;reject(calls.length===p.currentCount&&same(calls.slice(p.start,p.start+p.current.length),p.current),'Exact current h23 afternoon and midnight assertions required');
 const previous=[...calls.slice(0,p.start),...p.previous,...calls.slice(p.start+p.current.length)];reject(previous.length===p.previousCount&&sha(JSON.stringify(previous))===p.previousAssertionsSha256,'All201 previous focused assertions must restore exactly');return previous;
}

export const WEEKLY_CYP_CURRENT_SECTION='weeklyCypCurrentRevision';
export const WEEKLY_CYP_CURRENT_REVISION=Object.freeze({
  "version": 1,
  "predecessorCommit": "0acac0857310e57bc717a3d734e02923a5ea83a1",
  "previousContractSha256": "04db9c3dd25a41425f3b8f71f5d51ab23fcf4ad575b88710350b005dff04502b",
  "reviewedSourceChanges": [
    {
      "path": "tests/production-plan-import-link-ui.test.mjs",
      "previousSha256": "294ccb99a5758ad710358f8896cd7277c7f22694914e836b06dc4ce25fa04133",
      "currentSha256": "017801e29c6a3a145bd16a1536a52f144b5c2e7c7086a51b6951879304cf3037",
      "authenticatedPreviousAliases": [
        "936a1dc56d2713cb9fc69827b6acbeca522dbb06c3da1e60ea658ca9e434c7ae"
      ]
    },
    {
      "path": "src/app/(identity)/cuenta/plan-import-panel.js",
      "previousSha256": "3fb02bb63848059a8d045ca7d780e59a0b7b7093fa21d1c490604f9763c2cf00",
      "currentSha256": "a532eefe56961ba7a9c3a33e5a888f7b4b4affee837412a2aba4066fb0ee1882"
    },
    {
      "path": "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
      "previousSha256": "625c33c7b957dc922a5d9132fc0385c968dc573af4ff7a2f52a4fe111d0b42a2",
      "currentSha256": "060e128b54eefdadfbabac45c3ec696934f5e74d79b9e26e905081128e8e99c5",
      "authenticatedPreviousAliases": [
        "a522852b7c82cd978a3f758137d8505c43b8d4edae269f215dda4ca51d787b2f"
      ]
    },
    {
      "path": "src/lib/plan-import-analyzer.mjs",
      "previousSha256": "e3b6a312e9b0399533bb6c61b78a0c4bc036c5653d2e39628744d67f9e44a9f7",
      "currentSha256": "0427c7fbdf0ba27b07c328661e52731c996e0a7b5f0749dcc6207410b28c52bb"
    },
    {
      "path": "src/lib/plan-import-ooxml.mjs",
      "previousSha256": "473a0ac3199ef044107a2847059a6fea1c04f9716af4b8c4008623f0deb80b4d",
      "currentSha256": "a146b9b300086bd8f44af6549d75611f7ac542a6c6c2f9eddf099cd8fc0f9251",
      "authenticatedPreviousAliases": [
        "00c14c85a01734f9b77e508ef8c30fd1b1fa9e1d921b632649f93c534cc9cdd5"
      ]
    },
    {
      "path": "src/lib/plan-import-policy.mjs",
      "previousSha256": "4149d1db8f2038dcb9d9799010e5379bf4755ac632d22e2a01a407f6fb5971e4",
      "currentSha256": "f2d73b8c58df571fb0dc6e5d76e2fb5d60daffa6ed6a41bc2be3c7e536458696"
    },
    {
      "path": "src/lib/plan-import-store.mjs",
      "previousSha256": "d1db682c5f8e52985596e12b6ca7f759cd62c9436840377e91e98f206cde4d47",
      "currentSha256": "455c06e64301b2679e1278cc288cd4b06c875a222339e15c6720c58bc1f011c2"
    }
  ],
  "validationPredecessors": [
    {
      "path": "scripts/lib/home-decisions-current-ci-lineage.mjs",
      "sha256": "35a27b696cf1b2282fc1da41eb6f7f8173ccf2477cffbc48483bb83a50fef44b"
    },
    {
      "path": "tests/production-home-decisions-current-ci-lineage.test.mjs",
      "sha256": "31df3637107941e47985305ddc5704c061b135dbc5f4b34c880b5f75accb02e8"
    },
    {
      "path": "scripts/lib/ooxml-accounting-current-ci-lineage.mjs",
      "sha256": "bd078b7faa74affff2e78f86d1c26270f3a78bdf2b8b20b56352ff1da4953104",
      "authenticatedPreviousAliases": [
        "da926d18f6e71037405ef5e9220097eb2eaec3167d759dad5175578ad9d1b82e"
      ]
    },
    {
      "path": "scripts/verify-consumption-feedback-ci.mjs",
      "sha256": "537c70c6accdccc8220fc438502dd1af4da7a6f5fa46cd0414f4f4b222240897",
      "authenticatedPreviousAliases": [
        "40b8bc71e33fdb72ce8dc3c82bcf175835eb39e2384c2be875841f070048aa72"
      ]
    },
    {
      "path": "scripts/verify-organization-usage-ci.mjs",
      "sha256": "a2e716b6e9199996d0425986b98f17e5a333003b6d3144b7dee12dbd7a80d659",
      "authenticatedPreviousAliases": [
        "be7458395db29bf5cbbcd71736192cb59cd15b61b16c3f742a07a946753b220a"
      ]
    },
    {
      "path": "scripts/verify-plan-measurement-ci.mjs",
      "sha256": "86e9fe3dbe138caf327a2ea09c7b817cc0e8bf88b8ed273d0cf5363e95a0176f",
      "authenticatedPreviousAliases": [
        "38fe0338a778cffbeaac94860cf35f8c15e72de8813964015986ddb2f3eab57f"
      ]
    },
    {
      "path": "tests/production-material-consumption-feedback-ci.test.mjs",
      "sha256": "87d154dce14a4d4aaa72b4ec05237cf57f62aef33e3fb4256571d8ed633b3c60",
      "authenticatedPreviousAliases": [
        "724dae07b355ea971bd0ca87355bda49998d6ff2dc65467e1d35bd7b27a550a9"
      ]
    },
    {
      "path": "tests/production-organization-usage-ci.test.mjs",
      "sha256": "6acf018a2c19559ee7a895e0de9eaa0508b52bc19d0a2d738783f8cdc47ba418",
      "authenticatedPreviousAliases": [
        "d73ec704f98bcd8bf737cfef9c0e2bfedf7d9b6a7acacc38d38e6e1e7ae39137"
      ]
    },
    {
      "path": "tests/production-plan-measurement-ci.test.mjs",
      "sha256": "286ea19ff474a4bda4254650faa49cdc9b40dd54bcb5a878d61941f960a85a2b",
      "authenticatedPreviousAliases": [
        "e5c5a0413eafa50e76e2a29c2f6aa7f743485bb02a07594fc51f48c514de0494"
      ]
    },
    {
      "path": "tests/production-plan-measurement-current-ci-lineage.test.mjs",
      "sha256": "4dfbc2f58044ddbcde52a00ae1017e810c1c9893c01164c90beb1b03c371aaf7",
      "authenticatedPreviousAliases": [
        "e8e37a1998d3990190e1a802ace1ea6fde2a291c4effea69613b600c6bd09cfe"
      ]
    },
    {
      "path": "scripts/lib/integrated-identity-current-ci-lineage.mjs",
      "sha256": "2b9b7f26beb8aa2ae1d6ba9cab9c1a0bee6c457ce5f17a0eb7ea8f1fcb7c9faa"
    },
    {
      "path": "scripts/lib/participant-preanalysis-current-ci-lineage.mjs",
      "sha256": "f1e94bbb3f370c769fa4ce74fb70310b4617605d890ffacc7113fc9fce736399"
    },
    {
      "path": "scripts/lib/plan-measurement-current-ci-lineage.mjs",
      "sha256": "0ef5c541e380a67d8d19bbf0b225af768e3f0fca557cb32c993bbe9f496ce9cb"
    },
    {
      "path": "scripts/lib/field-outbound-current-ci-lineage.mjs",
      "sha256": "13656381f1e032bb82b43d3c6ea9a7db04b42ec15359e758e729d9edb7165afa"
    }
  ],
  "proofSourceDeltas": [
    {
      "id": "intake-ui",
      "family": "UI_INTAKE",
      "additions": [
        "src/lib/plan-import-cyp-curve.mjs"
      ],
      "previousCount": 34,
      "currentCount": 35,
      "previousPathsSha256": "6a42e27db8035b6e903d752b59f323d501c204ed09b4bdfcc8cb0c3b0b29ce32",
      "currentPathsSha256": "195264635c61b946b37f07bcbf8227647da22237bb43a981755be8cc2b2764ed"
    },
    {
      "id": "project-preparation-ui",
      "family": "UI_PREPARATION",
      "additions": [
        "src/lib/plan-import-cyp-curve.mjs"
      ],
      "previousCount": 21,
      "currentCount": 22,
      "previousPathsSha256": "2434b6d29bf5d076dc8c1685a9d7302439365f1a476a5f9f6b1533253ab8e169",
      "currentPathsSha256": "cf0c7022649725745f7a58c7f5d21b83c9a97f3e684ccc832e3533fba800b48e"
    },
    {
      "id": "portfolio-ui",
      "family": "UI_PORTFOLIO",
      "additions": [
        "src/lib/plan-import-cyp-curve.mjs"
      ],
      "previousCount": 18,
      "currentCount": 19,
      "previousPathsSha256": "e239eed23a483d3c3b9e2f19c19bb0714f2a5090bc3aa0fa7b093d8146841215",
      "currentPathsSha256": "a877471d19d373def1c2ba1f255aa4e5edafa5524bda71625a151d8c058a1aae"
    },
    {
      "id": "identity-only-ui",
      "family": "UI_IDENTITY_ONLY",
      "additions": [
        "src/lib/plan-import-cyp-curve.mjs"
      ],
      "previousCount": 148,
      "currentCount": 149,
      "previousPathsSha256": "bdbd7164a1191259bc6a414e327027e97796cc74e3e5f6e8970d3ac752b70a06",
      "currentPathsSha256": "b10d37cab7e7bcf5c549a5c4af269495c2df6bfc0b6ef038d4456cbe2bcb776c"
    },
    {
      "id": "focused-workspace-ui",
      "family": "UI_FOCUSED_WORKSPACE",
      "additions": [
        "src/lib/plan-import-cyp-curve.mjs"
      ],
      "previousCount": 184,
      "currentCount": 185,
      "previousPathsSha256": "2fc2eaf4f05e8f58b4fe703709c5b421a2760fe331e64ebf680d566aece4d6e8",
      "currentPathsSha256": "efbebce1fcdf6f8613b8b30c2ca6dde85af82ba4bd797578282a6375212d1853"
    },
    {
      "id": "field-task-pagination-ui",
      "family": "UI_FIELD_TASK_PAGINATION",
      "additions": [
        "src/lib/plan-import-cyp-curve.mjs"
      ],
      "previousCount": 65,
      "currentCount": 66,
      "previousPathsSha256": "37c4005666f2a3f09a857c3153dd49c2dd49e0f76337b135e293cabb2d34850b",
      "currentPathsSha256": "f24faeb0e27ba7e075312e532190e2ad62e8cf1dd97acfff7c1a9acaf29e98ac"
    }
  ],
  "proofProducerDeltas": [
    {
      "id": "plan-baseline-postgres",
      "producer": "scripts/verify-plan-baseline-postgres.mjs",
      "path": ".vercel/private/approved-plan-baseline-evidence/postgres.json",
      "previousProducerSha256": "e6dd0da63d68af0816637e661c19530a62b4b91d71022f3d78fc6b29c7bc878c",
      "currentProducerSha256": "e4c8c13b4b9082d5b139b231140d4f4fd722fdd82c09f077952df6e7f12ea456"
    }
  ],
  "documentCurveCopy": {
    "version": 2,
    "dependencies": [
      "src/lib/plan-import-document-curve.mjs",
      "src/lib/plan-import-cyp-curve.mjs"
    ],
    "helperLfSha256": "05eb49f3948bef7d95580d5ee1bda3cf3c4592e235440a2dbfdb760c2fcb781e"
  },
  "baselineNative": {
    "historicalCheckCount": 16,
    "addedCheckNames": [
      "v5-local-OOXML-monthly-weekly-upload-no-Task-mismatch-review-ack",
      "v5-native-Project-lock-concurrent-review-and-APPLY-one-receipt",
      "v5-approved-source-explicit-GET-SELECT-no-automatic-baseline",
      "v5-concurrent-baseline-CAS-replacement-old-replay-no-reactivation",
      "v5-native-COMMIT-ACK-ROLLBACK-review-apply-selection-exact-UUID",
      "v5-source-review-APPLY-receipt-active-baseline-tamper-denied",
      "v5-current-authority-private-recovery-and-business-state-preserved"
    ],
    "totalCheckCount": 23
  },
  "browser": {
    "producer": "scripts/verify-plan-import-ui.mjs",
    "producerLfSha256": "cb76ddce38c6221effa78aba6ae5ce716bead59f587a42d74a2f2724ff453734",
    "widths": [
      320,
      390,
      768,
      1280
    ],
    "historicalCheckCount": 160,
    "addedCheckCount": 4,
    "totalCheckCount": 164,
    "investmentSourceCount": 31,
    "investmentSourcePathsSha256": "d8638a12e88f7f82c1c812617a019355ae40368989c8e344db8043fd9508b973",
    "historicalModes": {
      "checks": [
        "apply",
        "ambiguous",
        "recover",
        "manager"
      ],
      "decisionRejectionChecks": [
        "decision-rejected",
        "decision-rejected-reload",
        "decision-unconfirmed"
      ],
      "uploadRejectionChecks": [
        "upload-source-rejected",
        "upload-source-rejected-reload",
        "upload-quota-rejected",
        "upload-quota-rejected-reload",
        "upload-unconfirmed"
      ],
      "spreadsheetChecks": [
        "ooxml-apply",
        "ooxml-upload-recover"
      ],
      "cypChecks": [
        "cyp-review",
        "cyp-recover"
      ],
      "monthlyCurveChecks": [
        "curve-review",
        "curve-recover",
        "curve-revoked",
        "curve-invalid-denial"
      ],
      "cypCurveChecks": [
        "cyp-curve-review",
        "cyp-curve-recover",
        "cyp-curve-pending-revoked",
        "cyp-curve-failed-revoked"
      ],
      "closeReviewChecks": [
        "close-conserve",
        "close-discard",
        "close-save",
        "close-clean",
        "close-uncertain",
        "close-private-denial"
      ],
      "calendarChecks": [
        "calendar-local-proposal",
        "calendar-private-denial"
      ],
      "planLinkChecks": [
        "link-ready",
        "link-canonical-denied",
        "link-wrong-project",
        "link-private-denial",
        "link-unsaved-file",
        "link-late",
        "link-pending",
        "link-malformed"
      ]
    },
    "retainedScreenshots": [
      {
        "width": 320,
        "path": ".vercel/private/plan-import-ui-investment-320.png"
      },
      {
        "width": 390,
        "path": ".vercel/private/plan-import-ui-investment-390.png"
      },
      {
        "width": 768,
        "path": ".vercel/private/plan-import-ui-investment-768.png"
      },
      {
        "width": 1280,
        "path": ".vercel/private/plan-import-ui-investment-1280.png"
      }
    ]
  },
  "nativeOrBrowserAcceptance": false,
  "consumerSourceDeltas": [
    {
      "family": "CONSUMPTION_FEEDBACK_UI",
      "previousCount": 22,
      "previousPathsSha256": "a199678963148d623e1312081691b3fd29930e215474b08838b368bad04dc0ac",
      "currentCount": 23,
      "currentPathsSha256": "c4eac1d0ee56262e1df6432ee23c7bdbe83f4a8e87266192284389c03e671483",
      "additions": [
        "src/lib/plan-import-cyp-curve.mjs"
      ]
    },
    {
      "family": "ORGANIZATION_USAGE_UI",
      "previousCount": 26,
      "previousPathsSha256": "46b06391df84b1952383d6a53dbe44f1f7385f844406050ed89954f5077dc02e",
      "currentCount": 27,
      "currentPathsSha256": "ba289e890f0f4c12aee451e19f4e5b8e3880c39df935dbba2eb243e8f45601e0",
      "additions": [
        "src/lib/plan-import-cyp-curve.mjs"
      ]
    },
    {
      "family": "MEASUREMENT_UI",
      "previousCount": 18,
      "previousPathsSha256": "4fe202152d08827101fe2f70ef6ddd12dd0c88f681723fc9350266b479899b2f",
      "currentCount": 19,
      "currentPathsSha256": "74e718eaa4c446355f64500947313efdd3f18225f409f87e96c42319d253ff69",
      "additions": [
        "src/lib/plan-import-cyp-curve.mjs"
      ]
    }
  ]
});
deepFreeze(WEEKLY_CYP_CURRENT_REVISION);

function weeklyCypSection(contract){
 if(!plain(contract)||!Object.hasOwn(contract,WEEKLY_CYP_CURRENT_SECTION))return null;
 const value=contract[WEEKLY_CYP_CURRENT_SECTION];exact(value,[...Object.keys(WEEKLY_CYP_CURRENT_REVISION),'validationSources'],'Exact weekly CyP revision required');
 for(const[key,expected]of Object.entries(WEEKLY_CYP_CURRENT_REVISION))reject(same(value[key],expected),'Unreviewed weekly CyP declaration: '+key);
 reject(Array.isArray(value.validationSources)&&same(value.validationSources.map(row=>row?.path),value.validationPredecessors.map(row=>row.path)),'Exact weekly CyP validators required');
 for(const row of value.validationSources){exact(row,['path','sha256'],'Exact weekly CyP validation reference required');reject(hash(row.sha256),'Weekly CyP validation hash required');}return value;
}
function weeklyCypReferences(value){return [...value.reviewedSourceChanges,...value.proofProducerDeltas.map(row=>({path:row.producer,previousSha256:row.previousProducerSha256,currentSha256:row.currentProducerSha256})),...value.validationPredecessors.map(row=>({path:row.path,previousSha256:row.sha256,currentSha256:value.validationSources.find(ref=>ref.path===row.path).sha256,authenticatedPreviousAliases:row.authenticatedPreviousAliases||[]}))];}
export function restoreWeeklyCypPreviousContract(contract){
 contract=restoreProgressEvidenceWaitPreviousContract(contract);
 const value=weeklyCypSection(contract);if(!value)return contract;const previous=structuredClone(contract);delete previous[WEEKLY_CYP_CURRENT_SECTION];
 for(const delta of value.proofSourceDeltas){const proofs=previous.extension?.proofs?.filter(row=>row.id===delta.id);reject(proofs?.length===1,'One weekly CyP proof required');proofs[0].sourceFiles=previousPaths(proofs[0].sourceFiles,delta);}
 for(const delta of value.proofProducerDeltas){const proofs=previous.extension?.proofs?.filter(row=>row.id===delta.id),records=previous.evidenceProducers?.filter(row=>row.path===delta.path&&row.producer===delta.producer);reject(proofs?.length===1&&records?.length===1&&proofs[0].producer===delta.producer&&proofs[0].path===delta.path&&proofs[0].producerSha256===delta.currentProducerSha256&&records[0].producerSha256===delta.currentProducerSha256,'Exact current weekly CyP producer required');proofs[0].producerSha256=delta.previousProducerSha256;records[0].producerSha256=delta.previousProducerSha256;}
 reject(sha(JSON.stringify(previous,null,2)+'\n')===value.previousContractSha256,'The complete published0ac monthly contract must restore exactly');return previous;
}
export function weeklyCypCurrentSourcePin(contract,ref){ref={...ref,sha256:progressEvidenceWaitPreviousSourcePin(contract,ref)};const value=weeklyCypSection(contract),row=value&&weeklyCypReferences(value).find(row=>row.path===ref.path);if(!row)return progressEvidenceWaitCurrentSourcePin(contract,ref);reject([row.previousSha256,row.currentSha256,...(row.authenticatedPreviousAliases||[])].includes(ref.sha256),'Only exact published0ac or weekly CyP pins may advance: '+ref.path);return progressEvidenceWaitCurrentSourcePin(contract,{...ref,sha256:row.currentSha256});}
export function weeklyCypPreviousSourcePin(contract,ref){ref={...ref,sha256:progressEvidenceWaitPreviousSourcePin(contract,ref)};const value=weeklyCypSection(contract),row=value&&weeklyCypReferences(value).find(row=>row.path===ref.path);return row&&ref.sha256===row.currentSha256?row.previousSha256:ref.sha256;}
export function restoreWeeklyCypConsumerSourceSet(family,files,contract){
 files=restoreWorksiteLiveHoursSourceSet(contract,family,files);
 const value=weeklyCypSection(contract);if(!value)return files;restoreWeeklyCypPreviousContract(contract);
 const delta=value.consumerSourceDeltas.find(row=>row.family===family);reject(Boolean(delta),'One exact weekly CyP consumer source family required: '+family);
 return previousPaths(files,delta);
}
export function weeklyCypProofSourceAdditions(spec){
 const outer=identityDestinationUxProofSourceAdditions(spec);if(outer.length)spec={...spec,sourceFiles:spec.sourceFiles.filter(file=>!outer.includes(file))};
 const delta=WEEKLY_CYP_CURRENT_REVISION.proofSourceDeltas.find(row=>row.id===spec?.id);if(!delta)return outer;
 const files=spec.sourceFiles;reject(Array.isArray(files)&&new Set(files).size===files.length&&same(files,[...files].sort()),'Distinct sorted weekly CyP source paths required');
 if(files.length===delta.currentCount&&sha(JSON.stringify(files))===delta.currentPathsSha256){previousPaths(files,delta);return [...delta.additions,...outer];}
 // Older callers may already have removed this outer addition. Their own
 // immutable count/digest validators remain responsible for inherited sets.
 reject(files.length<delta.currentCount&&!delta.additions.some(file=>files.includes(file)),'Unknown weekly CyP source set: '+delta.id);return outer;
}
export function verifyWeeklyCypCurrentSources(contract,readSource){
 verifyProgressEvidenceWaitCurrentSources(contract,readSource);
 const value=weeklyCypSection(contract);if(!value)return null;restoreWeeklyCypPreviousContract(contract);reject(typeof readSource==='function','Weekly CyP actual source reader required');
 const refs=weeklyCypReferences(value);reject(new Set(refs.map(row=>row.path)).size===refs.length,'Unique weekly CyP sources required');
 for(const row of refs){const bytes=readSource(row.path);reject(safe(row.path)&&Buffer.isBuffer(bytes)&&bytes.equals(Buffer.from(bytes.toString('utf8')))&&sha(bytes.toString('utf8').replaceAll('\r\n','\n'))===progressEvidenceWaitCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}),'Stale current weekly CyP source: '+row.path);}
 const copy=readSource('scripts/lib/plan-document-curve-fixture-copy.mjs');reject(Buffer.isBuffer(copy)&&sha(copy.toString('utf8').replaceAll('\r\n','\n'))===value.documentCurveCopy.helperLfSha256,'Exact two-dependency fixture copier required');
 return {version:1,completePreviousContractRestored:true,previousContractSha256:value.previousContractSha256,sourceSetChanges:value.proofSourceDeltas.length,nativeOrBrowserAcceptance:false};
}


function weeklyUiRequired(ok,reason){if(!ok)throw Object.assign(new Error('Weekly CyP browser proof rejected: '+reason),{code:'WEEKLY_CYP_UI_PROOF_REJECTED',reason});}
function weeklyUiKeys(value,keys,reason){weeklyUiRequired(plain(value)&&same(Object.keys(value).sort(),keys.slice().sort()),reason);}
function weeklyUiRead(readSource,file){let bytes;try{bytes=readSource(file);}catch{}weeklyUiRequired(Buffer.isBuffer(bytes),'SOURCE_MISSING');return bytes;}
export function weeklyCypInvestmentUiSourceFiles(readSource){
 const files=new Set(['package.json','package-lock.json']);
 function visit(file){weeklyUiRequired(safe(file)&&/^(src|tests)\//.test(file),'SOURCE_PATH');if(files.has(file))return;files.add(file);const bytes=weeklyUiRead(readSource,file),tree=parse(bytes.toString('utf8'),{sourceType:'module'}),imports=[];
  function walk(node){if(!node||typeof node!=='object')return;if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source)imports.push(node.source.value);if(node.type==='ImportExpression'){weeklyUiRequired(node.source.type==='StringLiteral','DYNAMIC_SOURCE');imports.push(node.source.value);}if(node.type==='CallExpression'&&node.callee?.type==='Import'){weeklyUiRequired(node.arguments.length===1&&node.arguments[0].type==='StringLiteral','DYNAMIC_SOURCE');imports.push(node.arguments[0].value);}for(const child of Object.values(node))if(Array.isArray(child))child.forEach(walk);else if(child&&typeof child==='object')walk(child);}
  walk(tree.program);for(const ref of imports.filter(ref=>ref.startsWith('.')))visit(path.posix.normalize(path.posix.join(path.posix.dirname(file),ref)));
 }
 visit('tests/fixtures/plan-document-curve-store-synthetic.mjs');visit('tests/fixtures/plan-import-cyp-curve-synthetic.mjs');return [...files].sort();
}
function weeklyUiSourceManifests(readSource){
 const producer=weeklyUiRead(readSource,WEEKLY_CYP_CURRENT_REVISION.browser.producer),tree=parse(producer.toString('utf8'),{sourceType:'module'}),declarations=tree.program.body.filter(node=>node.type==='VariableDeclaration').flatMap(node=>node.declarations),copied=declarations.find(node=>node.id?.name==='copiedFiles'),source=declarations.find(node=>node.id?.name==='sourceProof');
 weeklyUiRequired(copied?.init?.type==='ArrayExpression'&&copied.init.elements.every(node=>node.type==='StringLiteral'),'BROWSER_SOURCE_ROOTS');const files=copied.init.elements.map(node=>'src/app/(identity)/cuenta/'+node.value);
 const array=source?.init?.properties?.find(node=>node.key?.name==='spreadsheetSourceManifest')?.value?.callee?.object;weeklyUiRequired(array?.type==='ArrayExpression'&&array.elements.every(node=>node.type==='StringLiteral'),'SPREADSHEET_SOURCE_ROOTS');
 return {sourceManifest:files.slice(0,10),decisionSourceManifest:files.slice(10),spreadsheetSourceManifest:array.elements.map(node=>node.value),documentSourceManifest:['src/lib/plan-import-document-curve.mjs','scripts/lib/plan-document-curve-fixture-copy.mjs','src/lib/plan-import-cyp-curve.mjs'],linkSourceManifest:['src/lib/identity-return-path.mjs'],investmentSourceManifest:weeklyCypInvestmentUiSourceFiles(readSource)};
}
export function validateWeeklyCypImportUiProof(proof,readSource,{expectedHead,expectedTree,readEvidence}={}){
 return validateWeeklyCypImportUiCore(proof,readSource,{expectedHead,expectedTree,readEvidence},null);
}
function validateWeeklyCypImportUiCore(proof,readSource,{expectedHead,expectedTree,readEvidence}={},currentBinding){
 const n=WEEKLY_CYP_CURRENT_REVISION.browser,r=weeklyUiRequired;
 r(plain(proof)&&proof.validated===true&&proof.synthetic===true&&proof.realProviderCalls===false&&proof.providerCalls===0&&proof.productionDataWritten===false&&proof.fixtureRemoved===true&&same(proof.errors,[]),'LIMITS');
 r(typeof expectedHead==='string'&&/^[a-f0-9]{40}$/.test(expectedHead)&&typeof expectedTree==='string'&&/^[a-f0-9]{40}$/.test(expectedTree)&&proof.sourceRevision===expectedHead&&proof.sourceTree===expectedTree&&proof.sourceState==='EXACT_CI_SOURCE'&&proof.trackedClean===true,'SOURCE_IDENTITY');
 const producerSha256=currentBinding?currentBinding.producerLfSha256:n.producerLfSha256,producer=weeklyUiRead(readSource,n.producer);r(sha(producer)===producerSha256&&proof.harnessSha256===producerSha256,'PRODUCER');
 r(same(proof.widths,n.widths)&&proof.baselineCheckCount===80&&proof.originalTotalCheckCount===96&&proof.totalCheckCount===(currentBinding?180:164)&&proof.planLinkSubcaseCount===40,'TOTALS');
 for(const[field,modes]of Object.entries(n.historicalModes)){const expected=field==='calendarChecks'?modes.flatMap(mode=>n.widths.map(width=>({width,mode}))):n.widths.flatMap(width=>modes.map(mode=>({width,mode})));r(Array.isArray(proof[field])&&same(proof[field].map(row=>({width:row?.width,mode:row?.mode})),expected),'HISTORICAL_LEDGER_'+field);}
 r(Object.keys(n.historicalModes).reduce((sum,field)=>sum+proof[field].length,0)===160,'HISTORICAL_TOTAL');
 const manifests=weeklyUiSourceManifests(readSource);r(manifests.investmentSourceManifest.length===n.investmentSourceCount&&sha(JSON.stringify(manifests.investmentSourceManifest))===n.investmentSourcePathsSha256,'INVESTMENT_CLOSURE');
 for(const[field,files]of Object.entries(manifests)){r(Array.isArray(proof[field])&&same(proof[field].map(row=>row?.path).sort(),[...files].sort()),'MANIFEST_'+field);for(const row of proof[field]){weeklyUiKeys(row,['path','sha256'],'MANIFEST_REFERENCE');r(hash(row.sha256)&&sha(weeklyUiRead(readSource,row.path))===row.sha256,'SOURCE_BYTES');}}
 r(Array.isArray(proof.fixtureTransforms)&&proof.fixtureTransforms.length===2,'COPY_CHAIN');let generated=weeklyUiRead(readSource,'src/app/(identity)/cuenta/plan-source-curve.mjs');const original=generated;
 for(const[index,dependency]of WEEKLY_CYP_CURRENT_REVISION.documentCurveCopy.dependencies.entries()){const before=generated,needle='../../../lib/'+path.posix.basename(dependency);r(before.toString('utf8').split(needle).length===2,'COPY_IMPORT');generated=Buffer.from(before.toString('utf8').replace(needle,'./'+path.posix.basename(dependency)));r(same(proof.fixtureTransforms[index],{path:'src/app/(identity)/cuenta/plan-source-curve.mjs',kind:'FLATTENED_FIXTURE_RELATIVE_IMPORT',sourceSha256:sha(original),copiedBeforeSha256:sha(before),fixtureSha256:sha(generated),fixtureRelativePath:'app/plan-source-curve.mjs',dependencySourcePath:dependency,dependencyFixturePath:'app/'+path.posix.basename(dependency)}),'COPY_CHAIN');}
 r(Array.isArray(proof.investmentCurveChecks)&&same(proof.investmentCurveChecks.map(row=>row?.width),n.widths),'INVESTMENT_MATRIX');const screenshots=new Set(),receipts=new Set();let sourceSha=null,context=null;
 for(const row of proof.investmentCurveChecks){weeklyUiKeys(row,['width','mode','canonicalStoreAndHttp','localOoxmlParser','transport','sourceSha256','sourceManifestContext','weeklyPeriods','monthlyPeriods','exactDifference','uncheckedConsentAndMismatchReviewBlocked','acknowledgmentBoundToReview','keyboard48AndCrossMonth','modeTogglePreservesSelection','immutableApplyReceipt','lostCommitAckRecoveredAfterReload','applyPosts','recoveryReads','existingTasksPreserved','taskSqlAttempts','baselineEffects','realProviderCalls','sourceDownloads','screenshot'],'INVESTMENT_CASE');
  r(row.mode==='investment-monthly-weekly'&&row.canonicalStoreAndHttp===true&&row.localOoxmlParser===true&&row.transport==='RECONSTRUCTED_NODE_FORMDATA_FROM_VERIFIED_BROWSER_FILE'&&hash(row.sourceSha256)&&row.weeklyPeriods===48&&row.monthlyPeriods===12&&row.exactDifference==='0.0470000'&&['uncheckedConsentAndMismatchReviewBlocked','acknowledgmentBoundToReview','keyboard48AndCrossMonth','modeTogglePreservesSelection','lostCommitAckRecoveredAfterReload'].every(key=>row[key]===true)&&row.applyPosts===1&&row.recoveryReads===1&&row.existingTasksPreserved===5001&&row.taskSqlAttempts===0&&row.baselineEffects===false&&row.realProviderCalls===0&&row.sourceDownloads===0,'INVESTMENT_FACTS');
  weeklyUiKeys(row.sourceManifestContext,['projectId','scope'],'INVESTMENT_CONTEXT');r(row.sourceManifestContext.projectId==='project-document-synthetic'&&hash(row.sourceManifestContext.scope)&&(!sourceSha||row.sourceSha256===sourceSha)&&(!context||same(row.sourceManifestContext,context)),'INVESTMENT_CONTEXT');sourceSha=row.sourceSha256;context=row.sourceManifestContext;
  r(typeof row.immutableApplyReceipt==='string'&&row.immutableApplyReceipt.length>0&&!receipts.has(row.immutableApplyReceipt),'APPLY_RECEIPT');receipts.add(row.immutableApplyReceipt);
  r(typeof row.screenshot==='string'&&new RegExp('^\\.vercel/private/investment-ui-[a-zA-Z0-9_-]+/investment-'+row.width+'\\.png$').test(row.screenshot)&&!screenshots.has(row.screenshot)&&typeof readEvidence==='function','SCREENSHOT_PATH');screenshots.add(row.screenshot);let png;try{png=readEvidence(row.screenshot);}catch{}r(Buffer.isBuffer(png)&&png.length>24&&png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&png.readUInt32BE(16)===row.width&&png.readUInt32BE(20)===1000,'SCREENSHOT_BYTES');
 }
 return {status:'PASS',historicalCheckCount:160,addedCheckCount:4,totalCheckCount:164,investmentSourceCount:n.investmentSourceCount,transport:'RECONSTRUCTED_NODE_FORMDATA_FROM_VERIFIED_BROWSER_FILE',nativePostgresExecuted:false,humanAccepted:false};
}
export function validateWeeklyCypImportUiProofBytes(bytes,readSource,options){let proof;try{proof=JSON.parse(bytes.toString('utf8'));weeklyUiRequired(Buffer.from(bytes.toString('utf8')).equals(bytes),'ENCODING');}catch(error){if(error.code==='WEEKLY_CYP_UI_PROOF_REJECTED')throw error;weeklyUiRequired(false,'JSON');}return validateWeeklyCypImportUiProof(proof,readSource,options);}
// This separate entry binds the current producer before reusing the unchanged
// historical journeys. The legacy entry above always requires its exact164 hash.
export function validatePlanPartidaPreviewImportUiProofBytes(bytes,readSource,options={}){
 let proof;try{proof=JSON.parse(bytes.toString('utf8'));weeklyUiRequired(Buffer.from(bytes.toString('utf8')).equals(bytes),'ENCODING');}catch(error){if(error.code==='WEEKLY_CYP_UI_PROOF_REJECTED')throw error;weeklyUiRequired(false,'JSON');}
 const contract=JSON.parse(weeklyUiRead(readSource,'.github/workspace-acceptance-contract.json'));verifyPlanPartidaPreviewCurrentSources(contract,readSource);
 validateWeeklyCypImportUiCore(proof,readSource,options,PLAN_PARTIDA_PREVIEW_CURRENT_REVISION.browser);
 return validatePlanPartidaPreviewUiSupplement(proof,readSource,options);
}
// Validator-only shadow input. These buffers are never execution screenshots.
export function weeklyCypImportUiShadowFixture(readSource,expectedHead,expectedTree){
 const n=WEEKLY_CYP_CURRENT_REVISION.browser,proof={validated:true,synthetic:true,realProviderCalls:false,providerCalls:0,productionDataWritten:false,fixtureRemoved:true,errors:[],sourceRevision:expectedHead,sourceTree:expectedTree,sourceState:'EXACT_CI_SOURCE',trackedClean:true,harnessSha256:n.producerLfSha256,widths:[...n.widths],baselineCheckCount:80,originalTotalCheckCount:96,totalCheckCount:164,planLinkSubcaseCount:40,fixtureTransforms:[]},evidence=new Map();
 for(const[field,modes]of Object.entries(n.historicalModes))proof[field]=field==='calendarChecks'?modes.flatMap(mode=>n.widths.map(width=>({width,mode}))):n.widths.flatMap(width=>modes.map(mode=>({width,mode})));
 for(const[field,files]of Object.entries(weeklyUiSourceManifests(readSource)))proof[field]=files.map(path=>({path,sha256:sha(weeklyUiRead(readSource,path))}));
 const view='src/app/(identity)/cuenta/plan-source-curve.mjs',original=weeklyUiRead(readSource,view);let generated=original;for(const dependency of WEEKLY_CYP_CURRENT_REVISION.documentCurveCopy.dependencies){const before=generated;generated=Buffer.from(before.toString('utf8').replace('../../../lib/'+path.posix.basename(dependency),'./'+path.posix.basename(dependency)));proof.fixtureTransforms.push({path:view,kind:'FLATTENED_FIXTURE_RELATIVE_IMPORT',sourceSha256:sha(original),copiedBeforeSha256:sha(before),fixtureSha256:sha(generated),fixtureRelativePath:'app/plan-source-curve.mjs',dependencySourcePath:dependency,dependencyFixturePath:'app/'+path.posix.basename(dependency)});}
 proof.investmentCurveChecks=n.widths.map(width=>{const screenshot='.vercel/private/investment-ui-shadow/investment-'+width+'.png',png=Buffer.alloc(25);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(width,16);png.writeUInt32BE(1000,20);evidence.set(screenshot,png);return {width,mode:'investment-monthly-weekly',canonicalStoreAndHttp:true,localOoxmlParser:true,transport:'RECONSTRUCTED_NODE_FORMDATA_FROM_VERIFIED_BROWSER_FILE',sourceSha256:'a'.repeat(64),sourceManifestContext:{projectId:'project-document-synthetic',scope:'b'.repeat(64)},weeklyPeriods:48,monthlyPeriods:12,exactDifference:'0.0470000',uncheckedConsentAndMismatchReviewBlocked:true,acknowledgmentBoundToReview:true,keyboard48AndCrossMonth:true,modeTogglePreservesSelection:true,immutableApplyReceipt:'synthetic-apply-'+width,lostCommitAckRecoveredAfterReload:true,applyPosts:1,recoveryReads:1,existingTasksPreserved:5001,taskSqlAttempts:0,baselineEffects:false,realProviderCalls:0,sourceDownloads:0,screenshot};});
 return {proof,evidence,boundary:'VALIDATOR_ONLY_NOT_BROWSER_EXECUTION'};
}

// This outer companion preserves the complete published monthly/weekly contract.
// It changes no measured source path set and certifies only synthetic evidence.
export const PROGRESS_EVIDENCE_WAIT_CURRENT_SECTION='progressEvidenceWaitCurrentRevision';
export const PROGRESS_EVIDENCE_WAIT_CURRENT_REVISION=Object.freeze({
  "version": 1,
  "predecessorCommit": "5e25fcb01a33c327af86cb5f360209c67e1a28d3",
  "previousContractSha256": "0134ff841636654e447148bcc81f7c2127763089dd16b10166c4e26632b01b28",
  "reviewedSourceChanges": [
    {
      "path": "src/lib/meta-field-bridge.mjs",
      "previousSha256": "6ddb62df2dc3dab50a5d11071a4f0741dec8f94feeb96ce16a32ca29d176aa63",
      "currentSha256": "79c961cf91f988e5d913cfb241a887c26a78d49e04ebf2c5fbb2bf6a74bc809b",
      "previousRawSha256": "840868b35f1b39f832fb8e4b70179c04ca15f81f6b22166600defa98b31ae8d2",
      "currentRawSha256": "105ed2432a753d0d70d6a1dc22b868ae41bd3878a379134f39e0c946d7ec0fc5"
    },
    {
      "path": "src/lib/meta-field-conversation.mjs",
      "previousSha256": "a839410418cafdc915e827ff993f8d83b268cadec08157ff9a8906d27d61c6dc",
      "currentSha256": "2da5b4a58e4f62a912d4df4bd93574c9907c6561123fe5ffabdd12420b72047f",
      "previousRawSha256": "ed8feee27c81dc550e0015e1a8bedcc1c65689c26b6483d8ca4820054b2f106e",
      "currentRawSha256": "77c51cbe6ac48087085acf114660a8979428f2e67dafdde6cf4ae0e09cae466d"
    },
    {
      "path": "scripts/verify-meta-field-bridge-postgres.mjs",
      "previousSha256": "bcb9e3c22b2b4169d0ce5ccbbd26ae4c50d3ade8959a0c73dbbc52ad3d59fd44",
      "currentSha256": "1580fcf08d81f0778cb4240215060d51f321671eba2d1b2d72aac7f800d3ee63",
      "previousRawSha256": "71e32b9db118b3948e94432d306420d6b674d89d2bb7089d320f6b906ba30332",
      "currentRawSha256": "e191bbe05d70186a52af06198d1a45e42a3d46a1badc22420961daaec60a38f4"
    },
    {
      "path": "tests/production-meta-field.test.mjs",
      "previousSha256": "4f4d02e455d3a445973842908949f536ef2723655a1d36d00146d22ab5e121f0",
      "currentSha256": "fdc0ddf2cf5fab717654860bdd89543a70c161cb9fac7ab3fdd0cbc96d1c1e18",
      "previousRawSha256": "97620985477f5320815e28eb5b85a8fda9d1da5e18ed6377e562d18e896e05f2",
      "currentRawSha256": "30a9302f2f0da2c2e749e2de8eb3111e429a5dfff7eed0dcde099ecbfb74ec1e"
    },
    {
      "path": "scripts/verify-company-channel-postgres.mjs",
      "previousSha256": "ae2031c88abba7716cd7a56afcb1546c4bf706d8381901c0c2272fb023866320",
      "currentSha256": "500d3b39c03295b1c10ea1aed48bcbb5d3171f39370947fc9e5d657f23985079",
      "previousRawSha256": "d7886cf87a9d6ddfc0373aff76467bab4913bff84231f299543b6549264d70e8",
      "currentRawSha256": "782695c1c4a21ce52a146432fbc323f5df01c91b15655b03f24141596c6bb45e"
    }
  ],
  "validationPredecessors": [
    {
      "path": "scripts/lib/home-decisions-current-ci-lineage.mjs",
      "sha256": "59bed869142fc27c1e663c53d95bbd8dbb66b08c5231d04bc9863d9e4ec612e6"
    },
    {
      "path": "tests/production-home-decisions-current-ci-lineage.test.mjs",
      "sha256": "95f8367157246020f35cdcad9c914e8022dd0fcc656d04201dd8bd5f050e9af5"
    }
  ],
  "proofSourceSets": [
    {
      "kind": "UNIT",
      "count": 139,
      "pathsSha256": "4903f545a3b30380477561563262496477b10fc30eed030053083321b2b8dcf4"
    },
    {
      "kind": "UI_BANK",
      "count": 143,
      "pathsSha256": "cae04a2e0c16e266bd5ae879e150ccff8e2ec0c155b5cb09ea050dc2836a6de6"
    },
    {
      "kind": "UI_JOINT",
      "count": 142,
      "pathsSha256": "c34d375a88ae4fe2be1624fdf4b98b4d2788401b3d2e0a9915b8976426abdab3"
    },
    {
      "kind": "UI_CAUSAL",
      "count": 142,
      "pathsSha256": "c34d375a88ae4fe2be1624fdf4b98b4d2788401b3d2e0a9915b8976426abdab3"
    },
    {
      "kind": "PG_COMPANY_KYC",
      "count": 236,
      "pathsSha256": "ead9d712f7d5bf0561efc2a0b7e971f6e55a82677c2a08cb16641686e37bdf38"
    },
    {
      "kind": "PG_FIELD",
      "count": 128,
      "pathsSha256": "4655f7b2e71f4fb5f3e9f6d71e00a5ccb828b9e87292566798cbc657ff812446"
    },
    {
      "kind": "PG_OVERTIME",
      "count": 113,
      "pathsSha256": "d68a4ef55c57de688cf210a033da50f59cc2833be5f6cbfb4221dba58121ae0a"
    },
    {
      "kind": "PG_PARTICIPANT_KYC_PREANALYSIS",
      "count": 238,
      "pathsSha256": "cd841d37ce905f066258d3f0c76ac1fd28b96e4c49b123663dc41164403bb0b5"
    }
  ],
  "native": {
    "producer": "scripts/verify-meta-field-bridge-postgres.mjs",
    "path": ".vercel/meta-field-evidence/postgres.json",
    "blockId": 26,
    "lane": "meta",
    "environment": "disposable-local-postgresql-actual-HMAC-and-real-canonical-bridge",
    "historicalCheckCount": 37,
    "historicalChecksSha256": "2f444d0cf71c4b7bfb2b818687064d36b3109ffacaf962c0f8abc68bc86f1f4d",
    "addedCheckNames": [
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
    "totalCheckCount": 46
  },
  "company": {
    "producer": "scripts/verify-company-channel-postgres.mjs",
    "path": ".vercel/private/company-channel-postgres-proof.json",
    "blockId": 29,
    "lane": "channels",
    "historicalCheckCount": 45,
    "supplementalCheckCount": 9,
    "totalCheckCount": 54,
    "progressWaitField": "evidenceWait"
  },
  "nativeOrBrowserAcceptance": false
});
deepFreeze(PROGRESS_EVIDENCE_WAIT_CURRENT_REVISION);
function progressEvidenceWaitSection(contract){
 if(!plain(contract)||!Object.hasOwn(contract,PROGRESS_EVIDENCE_WAIT_CURRENT_SECTION))return null;
 const value=contract[PROGRESS_EVIDENCE_WAIT_CURRENT_SECTION];exact(value,[...Object.keys(PROGRESS_EVIDENCE_WAIT_CURRENT_REVISION),'validationSources'],'Exact progress evidence wait companion required');
 for(const[key,expected]of Object.entries(PROGRESS_EVIDENCE_WAIT_CURRENT_REVISION))reject(same(value[key],expected),'Unreviewed progress evidence wait declaration: '+key);
 reject(Array.isArray(value.validationSources)&&same(value.validationSources.map(row=>row?.path),value.validationPredecessors.map(row=>row.path)),'Exact progress evidence wait validators required');
 for(const row of value.validationSources){exact(row,['path','sha256'],'Exact progress evidence wait validation reference required');reject(hash(row.sha256),'Progress evidence wait validation hash required');}return value;
}
function progressEvidenceWaitReferences(value){return [...value.reviewedSourceChanges,...value.validationPredecessors.map(row=>({path:row.path,previousSha256:row.sha256,currentSha256:value.validationSources.find(ref=>ref.path===row.path).sha256}))];}
export function restoreProgressEvidenceWaitPreviousContract(contract){
 contract=restoreIdentityDestinationUxPreviousContract(contract);
 const value=progressEvidenceWaitSection(contract);if(!value)return contract;const previous=structuredClone(contract);delete previous[PROGRESS_EVIDENCE_WAIT_CURRENT_SECTION];
 reject(sha(JSON.stringify(previous,null,2)+'\n')===value.previousContractSha256,'The complete published5e25 monthly and weekly contract must restore exactly');return previous;
}
export function progressEvidenceWaitCurrentSourcePin(contract,ref){
 ref={...ref,sha256:identityDestinationUxPreviousSourcePin(contract,ref)};const value=progressEvidenceWaitSection(contract),row=value&&progressEvidenceWaitReferences(value).find(row=>row.path===ref.path);if(!row)return identityDestinationUxCurrentSourcePin(contract,ref);
 reject([row.previousSha256,row.currentSha256].includes(ref.sha256),'Only exact published5e25 or progress evidence wait pins may advance: '+ref.path);return identityDestinationUxCurrentSourcePin(contract,{...ref,sha256:row.currentSha256});
}
export function progressEvidenceWaitPreviousSourcePin(contract,ref){ref={...ref,sha256:identityDestinationUxPreviousSourcePin(contract,ref)};const value=progressEvidenceWaitSection(contract),row=value&&progressEvidenceWaitReferences(value).find(row=>row.path===ref.path);return row&&ref.sha256===row.currentSha256?row.previousSha256:ref.sha256;}
export function verifyProgressEvidenceWaitCurrentSources(contract,readSource){
 verifyIdentityDestinationUxCurrentSources(contract,readSource);
 const value=progressEvidenceWaitSection(contract);if(!value)return null;restoreProgressEvidenceWaitPreviousContract(contract);reject(typeof readSource==='function','Progress evidence wait actual source reader required');
 const refs=progressEvidenceWaitReferences(value);reject(new Set(refs.map(row=>row.path)).size===refs.length,'Unique progress evidence wait sources required');
 for(const row of refs){const bytes=readSource(row.path);reject(safe(row.path)&&Buffer.isBuffer(bytes)&&bytes.equals(Buffer.from(bytes.toString('utf8')))&&sha(bytes.toString('utf8').replaceAll('\r\n','\n'))===identityDestinationUxCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}),'Stale current progress evidence wait source: '+row.path);}
 for(const row of value.proofSourceSets){const spec=contract.extension.proofs.find(spec=>spec.kind===row.kind);reject(Boolean(spec),'Required progress evidence wait proof source set: '+row.kind);const previous=restoreWorksiteLiveHoursSourceSet(contract,row.kind,spec.sourceFiles);reject(previous.length===row.count&&sha(JSON.stringify(previous))===row.pathsSha256,'Unchanged progress evidence wait source set required: '+row.kind);}
 return {version:1,completePreviousContractRestored:true,previousContractSha256:value.previousContractSha256,sourceSetChanges:0,nativeOrBrowserAcceptance:false};
}
function progressWaitNativeRequired(ok,reason){if(!ok)throw Object.assign(new Error('Progress evidence wait native proof rejected: '+reason),{code:'PROGRESS_EVIDENCE_WAIT_NATIVE_PROOF_REJECTED',reason});}
export function validateProgressEvidenceWaitNativeProofBytes(bytes,contract,readSource){
 const value=progressEvidenceWaitSection(contract);if(!value)return null;const r=progressWaitNativeRequired,n=value.native;
 r(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=256*1024,'PROOF_BYTES');const text=bytes.toString('utf8');r(bytes.equals(Buffer.from(text)),'PROOF_UTF8');let proof;try{proof=JSON.parse(text);}catch{r(false,'PROOF_JSON');}
 r(plain(proof)&&same(Object.keys(proof).sort(),['status','environment','checks','provider','blob','outbound','productionDataWritten','realMetaRequests','physicalAttendanceAccepted','realHumanIdentityAccepted','cleanup'].sort()),'PROOF_SHAPE');
 r(proof.status==='PASS'&&proof.environment===n.environment&&proof.provider==='controlled-synthetic-media-only'&&proof.blob==='controlled-private-byte-store'&&proof.outbound==='controlled-no-send-result-only','PROOF_STATE');
 r(Array.isArray(proof.checks)&&proof.checks.length===n.totalCheckCount&&sha(JSON.stringify(proof.checks.slice(0,n.historicalCheckCount)))===n.historicalChecksSha256&&same(proof.checks.slice(n.historicalCheckCount),n.addedCheckNames),'EXACT_HISTORICAL_AND_CURRENT_CHECKS');
 r(proof.productionDataWritten===false&&proof.realMetaRequests===0&&proof.physicalAttendanceAccepted===false&&proof.realHumanIdentityAccepted===false,'PROOF_LIMITS');
 r(plain(proof.cleanup)&&same(Object.keys(proof.cleanup).sort(),['poolClosed','ownConnectionsClosed','databaseRemoved','adminClosed'].sort())&&Object.values(proof.cleanup).every(value=>value===true),'CLEANUP');
 try{verifyProgressEvidenceWaitCurrentSources(contract,readSource);}catch(error){if(error.code==='HOME_DECISIONS_CURRENT_CI_LINEAGE_REJECTED')r(false,'CURRENT_SOURCES');throw error;}
 return {status:'PASS',historicalChecks:n.historicalCheckCount,addedChecks:n.addedCheckNames.length,checks:n.totalCheckCount,syntheticOnly:true,realAcceptance:false};
}
function progressEvidenceWaitReaderContract(readSource){
 const bytes=companyNativeRead(readSource,'.github/workspace-acceptance-contract.json');let contract;try{contract=JSON.parse(bytes);}catch{companyNativeRequired(false,'CONTRACT_JSON');}return contract;
}
export function validateProgressEvidenceWaitCompanyFacts(wait,core){
 const r=companyNativeRequired,k=companyNativeKeys;
 k(wait,['version','state','taskId','taskRevision','sectorId','progress','quantity','baseline','unit','originalDeadline','initial','recheck','resumed','routePrincipal','taskUnchanged','proposalCount'],'PROGRESS_WAIT_SHAPE');
 r(wait.version===1&&wait.state==='PROGRESS_EVIDENCE_WAIT'&&wait.taskId===core.taskId&&typeof wait.taskRevision==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(wait.taskRevision)&&Number.isFinite(Date.parse(wait.taskRevision+'Z'))&&wait.sectorId==='sector-main'&&wait.progress===25&&wait.quantity===null&&wait.baseline===null&&wait.unit===null&&wait.taskUnchanged===true&&wait.proposalCount===0,'PROGRESS_WAIT_MEASUREMENT');
 r(typeof wait.originalDeadline==='string'&&Number.isFinite(Date.parse(wait.originalDeadline))&&new Date(wait.originalDeadline).toISOString()===wait.originalDeadline,'PROGRESS_WAIT_DEADLINE');
 const eventIds=[];for(const name of ['initial','recheck','resumed']){const prompt=wait[name];k(prompt,name==='resumed'?['eventId','promptEventId','deadline']:['eventId','promptEventId','nonce','deadline'],'PROGRESS_WAIT_PROMPT_SHAPE');r(companyNativePattern(/^customer_webhook_[a-f0-9]{64}$/,prompt.eventId)&&prompt.eventId===prompt.promptEventId&&prompt.deadline===wait.originalDeadline,'PROGRESS_WAIT_PROMPT');eventIds.push(prompt.eventId);if(name!=='resumed')r(companyNativePattern(/^[a-f0-9]{20}$/,prompt.nonce),'PROGRESS_WAIT_NONCE');}
 r(new Set(eventIds).size===3&&wait.initial.nonce!==wait.recheck.nonce&&!eventIds.includes(core.progress.sourceEventId)&&!eventIds.includes(core.evidence.sourceEventId),'PROGRESS_WAIT_PROMPT_IDENTITY');
 const principal=wait.routePrincipal;k(principal,['organizationId','connectionId','routeId','routeEpoch','projectId','workerId','actorId','membershipId','assignmentRevision','bindingId'],'PROGRESS_WAIT_PRINCIPAL_SHAPE');
 r(principal.organizationId==='org-a'&&principal.connectionId==='channel-a'&&companyNativePattern(/^company_route_[a-f0-9]{64}$/,principal.routeId)&&Number.isSafeInteger(principal.routeEpoch)&&principal.routeEpoch>0&&principal.projectId===core.projectId&&principal.workerId==='worker-c'&&principal.actorId===core.progress.submittedBy&&principal.membershipId==='member'&&Number.isSafeInteger(principal.assignmentRevision)&&principal.assignmentRevision>0&&companyNativePattern(/^channel_binding_[a-f0-9]{32}$/,principal.bindingId),'PROGRESS_WAIT_PRINCIPAL');
 return {status:'PASS',syntheticOnly:true,realAcceptance:false};
}

export const IDENTITY_DESTINATION_UX_CURRENT_SECTION='identityDestinationUxCurrentRevision';
export const IDENTITY_DESTINATION_UX_CURRENT_REVISION=Object.freeze({
  "version": 1,
  "predecessorCommit": "8c3060ba70d7f997c75c203a2948b4975db94bdf",
  "previousContractSha256": "9511a06c538d2e11de2fdbbc9c947476f89da0402744201594772170fdfe518b",
  "reviewedSourceChanges": [
    {
      "path": "src/app/(identity)/cuenta/workspace-client.js",
      "previousSha256": "7f9612e2f92d582b1318c39d542060a9ab3d41df72e20511d659235601f10cb8",
      "currentSha256": "e53ad474a3677243fbcaff6ce526c0983514d42e78c6daf60e73ba06d6f63bec"
    },
    {
      "path": "src/app/(identity)/cuenta/workspace-view-routing.mjs",
      "previousSha256": "1f5d2827d0ad76282331d77b368d19c260d355eb37b1f56860a5ac485a7c9793",
      "currentSha256": "d02f2d11ec5ce4a1419ed79c9639cdad40174c236382853778fc984f071e4df4"
    },
    {
      "path": "tests/production-focused-workspace-navigation.test.mjs",
      "previousSha256": "87ac26aa97c3efcb89bf2ce96abb0e9a2da9773f40fd3907f64815eaf8429b72",
      "currentSha256": "5f6614ed798d02be2b99de9267c2766ec61e8d1b4d46c3fefed3aa69832bde7e"
    },
    {
      "path": "tests/production-integrated-identity-current-ci-lineage.test.mjs",
      "previousSha256": "7563982646aebf713696686499ae5fdde8cc007fec3b28f448e728c7e7cda68d",
      "currentSha256": "925cc5f64fdd5fb8cef7f1ea0d2b22eed7ac3f980f89828ed05cc3d6a476a8d1"
    }
  ],
  "validationPredecessors": [
    {
      "path": "scripts/lib/home-decisions-current-ci-lineage.mjs",
      "sha256": "7063a942c736b5fe35b40ad2eac018afdd188333a7792dda8b328ed9b860c1cd"
    },
    {
      "path": "tests/production-home-decisions-current-ci-lineage.test.mjs",
      "sha256": "8088480f2864dc860f6e4dbf3f9a15a1f29c333cb2e7e4e246ee6b7a6fc4ce2a"
    },
    {
      "path": "tests/production-integrated-identity-ui-producer-migration.test.mjs",
      "sha256": "e3f47007ae8365064e8dc625aee4190fb44d8291a7e098cec0bcc8c19532282c"
    }
  ],
  "browser": {
    "producerSourceHistory": {
      "previousBytes": 55811,
      "currentBytes": 77713,
      "inverseHunks": [
        {
          "currentOffsetCharacters": 4899,
          "previousText": "copyGraph('src/app/(identity)/cuenta/workspace-client.js');copyGraph('src/app/(identity)/cuenta/workspace-recovery-journal.mjs');copyGraph('src/lib/participant-policy.mjs');\n",
          "currentText": "copyGraph('src/app/(identity)/cuenta/workspace-client.js');copyGraph('src/app/(identity)/cuenta/workspace-recovery-journal.mjs');copyGraph('src/lib/participant-policy.mjs');copyGraph('src/app/(identity)/cuenta/onboarding-guide.js');\n"
        },
        {
          "currentOffsetCharacters": 5793,
          "previousText": "",
          "currentText": "import {OnboardingGuide} from './(identity)/cuenta/onboarding-guide';\n"
        },
        {
          "currentOffsetCharacters": 5986,
          "previousText": " const [context,setContext]=useState('A');\n",
          "currentText": " const [context,setContext]=useState('A'),[guideObservation,setGuideObservation]=useState(null);\n const observeGuide=useCallback(value=>setGuideObservation({context,value}),[context]);\n const initialProjectId=typeof window==='undefined'?'':new URL(window.location.href).searchParams.get('obra')||'';\n"
        },
        {
          "currentOffsetCharacters": 6728,
          "previousText": " return <main style={{maxWidth:1000,margin:'0 auto'}}><div><button onClick={()=>setContext('A')}>Contexto A</button><button onClick={()=>setContext('B')}>Contexto B</button></div><AccountWorkspace key={context} getSessionToken={token}/></main>;\n",
          "currentText": " return <main style={{maxWidth:1000,margin:'0 auto'}}><div><button onClick={()=>setContext('A')}>Contexto A</button><button onClick={()=>setContext('B')}>Contexto B</button></div><OnboardingGuide key={\"guide-\"+context} orgId={\"fixture-\"+context} orgRole=\"org:member\" observation={guideObservation?.context===context?guideObservation.value:null}/><AccountWorkspace key={\"workspace-\"+context} getSessionToken={token} onGuideObservation={observeGuide} initialProjectId={initialProjectId}/></main>;\n"
        },
        {
          "currentOffsetCharacters": 8320,
          "previousText": "const scopeA='a'.repeat(64),scopeB='b'.repeat(64),revision='2026-10-01T11:00:00.000001',checks=[],pageErrors=[],requestErrors=[],screenshots=[];\n",
          "currentText": "const scopeA='a'.repeat(64),scopeB='b'.repeat(64),revision='2026-10-01T11:00:00.000001',checks=[],destinationChecks=[],pageErrors=[],requestErrors=[],screenshots=[];\n"
        },
        {
          "currentOffsetCharacters": 8681,
          "previousText": "",
          "currentText": "async function visibleElementClick(page,handle){\n // Open only necessary disclosures by clicking their visible native summary.\n // Never set details.open or bypass the rendered user navigation.\n for(let depth=0;depth<12;depth++){\n  const summary=await page.evaluateHandle(node=>{let outer=null;const ownSummary=node.tagName==='SUMMARY'?node.parentElement:null;for(let parent=node.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS'&&!parent.open&&parent!==ownSummary)outer=parent;return outer?[...outer.children].find(child=>child.tagName==='SUMMARY')||null:null;},handle);\n  const element=summary.asElement();if(!element){await summary.dispose();break;}\n  assert.ok(await page.evaluate(node=>node.isConnected&&node.getClientRects().length>0&&!node.closest('[hidden],[inert],[aria-hidden=\"true\"]'),element),'Disclosure summary must already be visible');await element.click();await summary.dispose();\n }\n assert.ok(await page.evaluate(node=>node.isConnected&&node.getClientRects().length>0&&!node.closest('[hidden],[inert],[aria-hidden=\"true\"]'),handle),'Click target must be visible in the current screen');\n await handle.click();\n}\n"
        },
        {
          "currentOffsetCharacters": 10300,
          "previousText": " if(hiddenScreen){const id={identidad:'participant-title','mi-whatsapp':'worker-channel-title',cronograma:'schedule-title',recuperacion:'workspace-recovery-title'}[hiddenScreen];assert.ok(id,'Known real destination for '+label);const menu='nav[aria-label=\"Navegación de la obra\"]';if((await page.viewport()).width<1100)await page.select(menu+' select',id);else{const selector=menu+' a[href=\"#'+id+'\"]';const anchor=await page.$(selector);assert.ok(anchor,'Real destination link');await anchor.click();await anchor.dispose();}await page.waitForFunction(section=>document.querySelector('[data-workspace-screen=\"'+section+'\"]')?.hidden===false,{timeout:15000},hiddenScreen);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}\n\n",
          "currentText": " if(hiddenScreen){const id={identidad:'participant-title','mi-whatsapp':'worker-channel-title',cronograma:'schedule-title',recuperacion:'workspace-recovery-title'}[hiddenScreen];assert.ok(id,'Known real destination for '+label);await chooseWorkspaceView(page,id);}\n"
        },
        {
          "currentOffsetCharacters": 11139,
          "previousText": " await page.evaluate(button=>{for(let parent=button.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;},handle);\n await handle.asElement().click();await handle.dispose();\n",
          "currentText": " await visibleElementClick(page,handle.asElement());await handle.dispose();\n}\nasync function chooseWorkspaceView(page,id){\n const own='nav[aria-label=\"Mi participación en la obra\"]';if(await page.$(own)){const anchor=await page.$(own+' a[href=\"#'+id+'\"]');assert.ok(anchor,'Private destination must be listed');await visibleElementClick(page,anchor);await anchor.dispose();await page.waitForFunction(target=>document.activeElement?.id===target,{timeout:15000},id);return;}\n const menu='nav[aria-label=\"Navegación de la obra\"]';if((await page.viewport()).width<1100)await page.select(menu+' select',id);else{const anchor=await page.$(menu+' a[href=\"#'+id+'\"]');assert.ok(anchor);await visibleElementClick(page,anchor);await anchor.dispose();}\n await page.waitForFunction(target=>document.activeElement?.id===target,{timeout:15000},id);\n"
        },
        {
          "currentOffsetCharacters": 11976,
          "previousText": "async function chooseWorkspaceView(page,id){const menu='nav[aria-label=\"Navegación de la obra\"]';if((await page.viewport()).width<1100)await page.select(menu+' select',id);else await page.click(menu+' a[href=\"#'+id+'\"]');await page.waitForFunction(target=>document.activeElement?.id===target,{timeout:15000},id);}\n",
          "currentText": ""
        },
        {
          "currentOffsetCharacters": 14441,
          "previousText": "async function createPage(width,current,sharedContext=null){\n",
          "currentText": "async function createPage(width,current,sharedContext=null,{initialPath=''}={}){\n assert.ok(initialPath===''||initialPath==='/?obra=p-a#worker-channel-title','Only the controlled same-origin project hint is allowed');\n"
        },
        {
          "currentOffsetCharacters": 19111,
          "previousText": "",
          "currentText": "    if(current.destinationPaging===true&&projectId)(current.destinationProjectReads??=[]).push({actor,projectId,afterTask:url.searchParams.get('afterTask')});\n"
        },
        {
          "currentOffsetCharacters": 19734,
          "previousText": "    if(current.mode==='late-project'&&projectId==='p-a'||current.mode==='late-company'&&actor==='A'||current.holdWorkspaceProject===projectId){\n",
          "currentText": "    if(current.mode==='late-project'&&projectId==='p-a'||current.mode==='late-company'&&actor==='A'||current.holdWorkspaceProject===projectId||current.holdWorkspacePage===projectId&&url.searchParams.has('afterTask')){\n"
        },
        {
          "currentOffsetCharacters": 20331,
          "previousText": "",
          "currentText": "     if(current.destinationPaging===true){const after=url.searchParams.get('afterTask'),pageIndex=after?after.endsWith('-second')?2:1:0,record=pageIndex===0?task:{...task,id:task.id+(pageIndex===1?'-second':'-third'),title:task.title+(pageIndex===1?' segunda página':' tercera página')};return answer(request,200,{scope,project:{id:projectId,name:'Obra A',status:'ACTIVE'},roleLabel:'Consulta',canPlanSchedule:false,tasks:[record],totalTasks:3,nextCursor:pageIndex<2?record.id:null});}\n"
        },
        {
          "currentOffsetCharacters": 23061,
          "previousText": "",
          "currentText": "    if(current.destinationHoldProfile===true)await new Promise(resolve=>(current.destinationHeldProfile??=[]).push(resolve));\n"
        },
        {
          "currentOffsetCharacters": 23811,
          "previousText": " await page.goto(origin,{waitUntil:'networkidle0'});await waitText(page,'Empresa de ensayo A');assert.equal(subscriptionReads.length,current.mode==='bootstrap'?1:0,'Only the bootstrap administrator consults closed subscription status');return {context,page};\n",
          "currentText": " await page.goto(origin+initialPath,{waitUntil:initialPath?'domcontentloaded':'networkidle0'});await waitText(page,'Empresa de ensayo A');assert.equal(subscriptionReads.length,current.mode==='bootstrap'?1:0,'Only the bootstrap administrator consults closed subscription status');return {context,page};\n"
        },
        {
          "currentOffsetCharacters": 24917,
          "previousText": "async function presentOwn(page){\n await click(page,'Consultar mi identidad');await waitText(page,'Persona de ensayo');await click(page,'Presentar mi identidad');\n",
          "currentText": "async function prepareOwn(page,{consult=true}={}){\n if(consult)await click(page,'Consultar mi identidad');await waitText(page,'Persona de ensayo');await click(page,'Presentar mi identidad');\n"
        },
        {
          "currentOffsetCharacters": 26015,
          "previousText": " await click(page,'Presentar para revisión');await waitText(page,'El resultado quedó sin confirmar');\n",
          "currentText": "}\nasync function presentOwn(page){await prepareOwn(page);await click(page,'Presentar para revisión');await waitText(page,'El resultado quedó sin confirmar');\n"
        },
        {
          "currentOffsetCharacters": 34018,
          "previousText": "",
          "currentText": "async function privacyDisclosure(page,open){await chooseWorkspaceView(page,open?'worker-channel-title':'participant-title');}\n\n"
        },
        {
          "currentOffsetCharacters": 34182,
          "previousText": " await identityOnly(page);await page.evaluate(()=>{const summary=[...document.querySelectorAll('summary')].find(node=>node.textContent==='Mi WhatsApp y mis avisos');assertSummary(summary);function assertSummary(node){if(!node)throw Error('Own privacy section missing');node.parentElement.open=true;}});\n await page.waitForSelector('#worker-channel-title');\n",
          "currentText": " await identityOnly(page);await privacyDisclosure(page,true);await page.waitForSelector('#worker-channel-title',{visible:true});\n"
        },
        {
          "currentOffsetCharacters": 35457,
          "previousText": " assert.ok(await page.$eval('summary',node=>node.getBoundingClientRect().height>=44),'Own privacy disclosure needs a44px touch target');\n",
          "currentText": " assert.ok(await page.$eval('nav[aria-label=\"Mi participación en la obra\"] a[href=\"#worker-channel-title\"]',node=>node.getBoundingClientRect().height>=44),'Own privacy navigation needs a44px touch target');\n"
        },
        {
          "currentOffsetCharacters": 53967,
          "previousText": "",
          "currentText": "\nconst destinationEntry='/?obra=p-a#worker-channel-title';\nconst destinationNames=['private-destination-initial-hash-held-canonical-mount-focus','private-destination-visible-guide-same-hash-and-browser-history','private-destination-context-change-cancels-held-private-mount','private-destination-revoked-canonical-access-and-history-stay-closed'];\nfunction destinationNetwork(current){\n const apiSequence=current.requests.map(row=>({path:row.path,method:row.method,actor:row.actor,projectId:row.projectId||null})),workerChannelGets=apiSequence.filter(row=>row.path==='/api/identity/worker-channel'&&row.method==='GET').length,totalPosts=apiSequence.filter(row=>row.method==='POST').length;\n assert.equal(workerChannelGets,0,'Navigation must not automatically read WhatsApp');assert.equal(totalPosts,0,'Navigation must not write');assert.equal(current.posts.length,0);assert.equal(current.channelPosts.length,0);assert.ok(apiSequence.every(row=>row.method==='GET'&&['/api/identity/workspace','/api/identity/participants'].includes(row.path)));\n return {apiSequence,workspaceGets:apiSequence.filter(row=>row.path==='/api/identity/workspace').length,participantGets:apiSequence.filter(row=>row.path==='/api/identity/participants').length,workerChannelGets,totalPosts,participantPosts:current.posts.length,channelPosts:current.channelPosts.length};\n}\nasync function destinationGeometry(page,id){\n await page.waitForFunction(target=>document.activeElement?.id===target&&document.getElementById(target)?.getClientRects().length>0,{timeout:15000},id);\n const geometry=await page.$eval('#'+id,node=>{const rect=node.getBoundingClientRect();return {id:node.id,visible:node.getClientRects().length>0,focused:document.activeElement===node,left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height,viewportWidth:innerWidth,viewportHeight:innerHeight,documentWidth:document.documentElement.scrollWidth,detailsOpen:node.closest('details')?.open??null,screen:node.closest('[data-workspace-screen]')?.dataset.workspaceScreen??null,screenHidden:node.closest('[data-workspace-screen]')?.hidden??null,otherPrivateScreenHidden:document.querySelector('[data-workspace-screen=\"'+(node.id==='worker-channel-title'?'identidad':'mi-whatsapp')+'\"]')?.hidden??null};});\n active.current.destinationGeometryObservation={...geometry};\n assert.equal(geometry.visible,true);assert.equal(geometry.focused,true);assert.ok(geometry.width>0&&geometry.height>0&&geometry.left>=0&&geometry.right<=geometry.viewportWidth+1&&geometry.top<geometry.viewportHeight&&geometry.bottom>0&&geometry.documentWidth<=geometry.viewportWidth);\n assert.equal(geometry.detailsOpen,null);assert.equal(geometry.screen,id==='worker-channel-title'?'mi-whatsapp':'identidad');assert.equal(geometry.screenHidden,false);assert.equal(geometry.otherPrivateScreenHidden,true);return geometry;\n}\nasync function noDestinationActivation(page){\n const forbidden=await page.evaluate(()=>{const panel=document.querySelector('[aria-labelledby=\"worker-channel-title\"]');if(!panel)return 0;const labels=['Generar código','Generar otro código','Revisar autorización de avisos','Guardar autorización','Continuar en WhatsApp','Copiar MENU','VINCULAR '];return [...panel.querySelectorAll('button,a,code')].filter(node=>node.matches('code,a[href*=\"wa.me\"]')||labels.some(label=>node.textContent.includes(label))).length;});assert.equal(forbidden,0);return forbidden;\n}\nasync function destinationScreenshot(page,name,width){\n const target=path.join(evidence,'destination-'+name+'-'+width+'.png');await page.screenshot({path:target,fullPage:true});const bytes=readFileSync(target);assert.ok(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));const pngWidth=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);assert.equal(pngWidth,width);assert.ok(height>0);return {path:path.relative(root,target).split(path.sep).join('/'),sha256:sha256(bytes),width:pngWidth,height};\n}\nasync function heldCanonical(current){for(let attempt=0;!current.held.length&&attempt<100;attempt++)await pause(20);assert.equal(current.held.length,1,'One canonical project GET must be held');}\nasync function guideDestination(page,id){\n const guide='section[aria-labelledby=\"onboarding-guide-title\"]';if(!await page.$('#onboarding-guide-content'))await click(page,'Abrir guía');\n const summary=await page.evaluateHandle(selector=>[...document.querySelector(selector).querySelectorAll('summary')].find(node=>node.textContent.trim()==='Elegir otro paso')||null,guide);assert.ok(summary.asElement());if(!await page.evaluate(node=>node.parentElement.open,summary))await visibleElementClick(page,summary.asElement());await summary.dispose();\n const position=id==='worker-channel-title'?9:id==='participant-title'?6:null;assert.ok(position);const button=await page.$(guide+' nav[aria-label=\"Pasos de inicio\"] button:nth-child('+position+')');assert.ok(button);await visibleElementClick(page,button);await button.dispose();\n await click(page,'Ir a este paso');await page.waitForFunction(target=>location.hash==='#'+target,{timeout:15000},id);return destinationGeometry(page,id);\n}\nasync function destinationDelayedMount(width){\n const current=newState('destination-delayed');current.holdWorkspaceProject='p-a';current.destinationHoldProfile=true;const {context,page}=await createPage(width,current,null,{initialPath:destinationEntry});await heldCanonical(current);\n assert.equal(await page.$('#worker-channel-title'),null);assert.equal(await page.$('#identity-access-title'),null);assert.equal(await page.evaluate(()=>location.hash),'#worker-channel-title');const beforeRelease={targetMounted:false,focused:false,heldCanonicalCount:current.held.length,...destinationNetwork(current)};\n current.holdWorkspaceProject=null;current.held.shift()();await identityOnly(page);for(let attempt=0;!current.destinationHeldProfile?.length&&attempt<100;attempt++)await pause(20);assert.equal(current.destinationHeldProfile?.length,1);const beforeProfileGeometry=await destinationGeometry(page,'worker-channel-title');current.destinationHoldProfile=false;current.destinationHeldProfile.shift()();await page.waitForFunction(()=>document.querySelector('[aria-labelledby=\"participant-title\"]')?.textContent.includes('Persona de ensayo'));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const geometry=await destinationGeometry(page,'worker-channel-title'),profileRead={heldBeforeNavigation:true,releasedAfterNavigation:true,beforeGeometry:beforeProfileGeometry,afterGeometry:geometry},activationControls=await noDestinationActivation(page),network=destinationNetwork(current);assert.equal(network.workspaceGets,2);assert.equal(network.participantGets,1);const screenshot=await destinationScreenshot(page,'delayed',width);\n destinationChecks.push({name:destinationNames[0],width,status:'PASS',trigger:'INITIAL_HASH_AND_CANONICAL_PROJECT_HINT',initialPath:destinationEntry,beforeRelease,geometry,profileRead,activationControls,...network,screenshot});await context.close();\n}\nasync function destinationOperationalAppend(page,current){\n current.approved=true;current.destinationPaging=true;current.row={...current.row,kyc:{...current.row.kyc,status:'APPROVED'}};\n await click(page,'Comprobar habilitación de obra');await waitRecordedTask(page,'Tarea operativa p-a');await chooseWorkspaceView(page,'schedule-title');assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),1);\n current.holdWorkspacePage='p-a';const button=await page.$('#schedule-load-more');assert.ok(button);await button.hover();await page.mouse.down();\n const observe=()=>page.evaluate(()=>{const button=document.getElementById('schedule-load-more'),rect=button?.getBoundingClientRect();return {activeId:document.activeElement?.id||'',activeTagName:document.activeElement?.tagName||'',scrollY,taskCount:document.querySelectorAll('[data-task-id]').length,buttonMounted:Boolean(button),buttonDisabled:button?.disabled??null,rect:rect?{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height}:null,viewportWidth:innerWidth,viewportHeight:innerHeight,firstTaskTop:document.querySelector('[data-task-id]')?.getBoundingClientRect().top??null};});\n const nativeFocus=row=>row.activeId==='schedule-load-more'&&row.activeTagName==='BUTTON'||row.activeId===''&&row.activeTagName==='BODY';\n const buttonBox=(row,visible)=>{assert.ok(row.rect&&Object.values(row.rect).every(Number.isFinite)&&row.rect.width>0&&row.rect.height>0);assert.ok(Number.isFinite(row.firstTaskTop));if(visible)assert.ok(row.rect.left>=0&&row.rect.right<=row.viewportWidth+1&&row.rect.top<row.viewportHeight&&row.rect.bottom>0,'OPERATIONAL_APPEND_BUTTON_VISIBLE');};\n const before=await observe();assert.equal(before.activeId,'schedule-load-more');assert.equal(before.activeTagName,'BUTTON');assert.equal(before.buttonDisabled,false);buttonBox(before,true);await page.mouse.up();await button.dispose();await heldCanonical(current);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const pending=await observe();current.destinationAppendObservation={before,pending,after:null};\n assert.ok(nativeFocus(pending),'OPERATIONAL_APPEND_FOCUS_DURING_READ');assert.equal(pending.buttonDisabled,true);buttonBox(pending,true);assert.ok(Math.abs(pending.rect.top-before.rect.top)<=3&&Math.abs(pending.rect.left-before.rect.left)<=3,'OPERATIONAL_APPEND_VIEWPORT_POSITION_DURING_READ');assert.equal(pending.taskCount,1);\n current.holdWorkspacePage=null;current.held.shift()();await settled(page);await page.waitForFunction(()=>document.querySelectorAll('[data-task-id]').length===2);const after=await observe();current.destinationAppendObservation.after=after;\n assert.ok(nativeFocus(after),'OPERATIONAL_APPEND_FOCUS_AFTER_READ');buttonBox(after,false);assert.equal(after.buttonDisabled,false);assert.equal(after.taskCount,2);assert.equal(after.buttonMounted,true);\n assert.deepEqual(current.destinationProjectReads,[{actor:'A',projectId:'p-a',afterTask:null},{actor:'A',projectId:'p-a',afterTask:'t-p-a'}]);\n return {canonicalAdmissionSimulated:true,totalTasks:3,projectReads:current.destinationProjectReads,before,pending,after};\n}\n\nasync function destinationPrivateDraft(page,current){\n await chooseWorkspaceView(page,'participant-title');await prepareOwn(page,{consult:false});const original=await page.$('[aria-labelledby=\"participant-title\"] form'),images=await page.$$eval('[aria-labelledby=\"participant-title\"] form fieldset img',nodes=>nodes.map(node=>node.src));assert.equal(images.length,2);\n const observe=async()=>{const facts=await page.evaluate(form=>{const capture=form.querySelector('[data-kyc-capture-step]'),choice=[...capture.querySelectorAll('label')].find(node=>node.textContent.includes('Leí el aviso y autorizo presentar estas imágenes'))?.querySelector('input');return {step:Number(capture.dataset.kycCaptureStep),consent:choice?.checked===true,formMounted:form.isConnected,formVisible:form.getClientRects().length>0,sameForm:form===document.querySelector('[aria-labelledby=\"participant-title\"] form'),imageCount:form.querySelectorAll('fieldset img').length};},original);const next=await page.$$eval('[aria-labelledby=\"participant-title\"] form fieldset img',nodes=>nodes.map(node=>node.src));return {...facts,sameImages:JSON.stringify(next)===JSON.stringify(images)};};\n const before=await observe();await chooseWorkspaceView(page,'worker-channel-title');const hidden=await observe();await chooseWorkspaceView(page,'participant-title');const after=await observe();\n for(const row of [before,hidden,after]){assert.equal(row.step,3);assert.equal(row.consent,true);assert.equal(row.formMounted,true);assert.equal(row.sameForm,true);assert.equal(row.imageCount,2);assert.equal(row.sameImages,true);}assert.equal(before.formVisible,true);assert.equal(hidden.formVisible,false);assert.equal(after.formVisible,true);assert.equal(current.posts.length,0);assert.equal(current.channelPosts.length,0);await click(page,'Cancelar');await original.dispose();await chooseWorkspaceView(page,'worker-channel-title');return {syntheticImagesOnly:true,submitted:false,before,hidden,after};\n}\nasync function destinationGuideHistory(width){\n const {current,context,page}=await startPrivacy(width,'NOT_SUBMITTED');const before=destinationNetwork(current);await privacyDisclosure(page,false);\n const history=[];history.push({action:'guide-private',hash:'#worker-channel-title',geometry:await guideDestination(page,'worker-channel-title')});await page.focus('nav[aria-label=\"Mi participación en la obra\"] a[href=\"#worker-channel-title\"]');assert.equal(await page.evaluate(()=>location.hash),'#worker-channel-title');\n history.push({action:'same-hash-reopen',hash:'#worker-channel-title',geometry:await guideDestination(page,'worker-channel-title')});history.push({action:'guide-identity',hash:'#participant-title',geometry:await guideDestination(page,'participant-title')});\n await page.goBack({waitUntil:'domcontentloaded'});assert.equal(await page.evaluate(()=>location.hash),'#worker-channel-title');history.push({action:'back',hash:'#worker-channel-title',geometry:await destinationGeometry(page,'worker-channel-title')});\n await page.goForward({waitUntil:'domcontentloaded'});assert.equal(await page.evaluate(()=>location.hash),'#participant-title');history.push({action:'forward',hash:'#participant-title',geometry:await destinationGeometry(page,'participant-title')});\n await page.goBack({waitUntil:'domcontentloaded'});history.push({action:'back-final',hash:'#worker-channel-title',geometry:await destinationGeometry(page,'worker-channel-title')});\n const navigationNetwork=destinationNetwork(current);assert.deepEqual(navigationNetwork,before,'Guide and same-document history must not read or write');const activationControls=await noDestinationActivation(page),draftPreservation=await destinationPrivateDraft(page,current),append=await destinationOperationalAppend(page,current),network=destinationNetwork(current),screenshot=await destinationScreenshot(page,'guide-history-append',width);\n destinationChecks.push({name:destinationNames[1],width,status:'PASS',trigger:'REAL_ONBOARDING_GUIDE',history,requestCountBefore:before.apiSequence.length,requestCountAfter:navigationNetwork.apiSequence.length,navigationNetwork,draftPreservation,append,activationControls,...network,screenshot});await context.close();\n}\nasync function destinationContextChange(width){\n const current=newState('destination-context');current.holdWorkspaceProject='p-a';const {context,page}=await createPage(width,current,null,{initialPath:destinationEntry});await heldCanonical(current);assert.equal(await page.$('#worker-channel-title'),null);\n await click(page,'Contexto B');await waitText(page,'Empresa de ensayo B');current.holdWorkspaceProject=null;current.held.shift()();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await settled(page);await pause(150);\n const targetMounted=await page.$('#worker-channel-title')!==null,privateMounted=await page.$('#identity-access-title')!==null,oldFactsVisible=await page.evaluate(()=>/Persona de ensayo|Titular propio WhatsApp A|MUST NEVER RENDER|Tarea operativa p-a/.test(document.body.innerText));assert.equal(targetMounted,false);assert.equal(privateMounted,false);assert.equal(oldFactsVisible,false);safeReferences(await references(page),0);\n const network=destinationNetwork(current);assert.deepEqual(network.apiSequence.map(row=>[row.path,row.actor,row.projectId]),[['/api/identity/workspace','A',null],['/api/identity/workspace','A','p-a'],['/api/identity/workspace','B',null]]);const screenshot=await destinationScreenshot(page,'context',width);\n destinationChecks.push({name:destinationNames[2],width,status:'PASS',initialPath:destinationEntry,heldBeforeContextChange:true,releasedAfterContextChange:true,currentActor:'B',targetMounted,privateMounted,oldFactsVisible,activationControls:await noDestinationActivation(page),...network,screenshot});await context.close();\n}\nasync function destinationRevokedAccess(width){\n const current=newState('destination-revoked'),{context,page}=await createPage(width,current,null,{initialPath:destinationEntry});await identityOnly(page);const initialGeometry=await destinationGeometry(page,'worker-channel-title');await guideDestination(page,'participant-title');await guideDestination(page,'worker-channel-title');\n current.denialCode='WORKSPACE_MEMBERSHIP_REQUIRED';await click(page,'Comprobar habilitación de obra');await settled(page);await page.waitForFunction(()=>!document.getElementById('identity-access-title')&&!document.getElementById('worker-channel-title')&&!document.getElementById('participant-title'));\n const beforeHistory=destinationNetwork(current),history=[];for(const [method,hash]of [['goBack','#participant-title'],['goForward','#worker-channel-title']]){await page[method]({waitUntil:'domcontentloaded'});assert.equal(await page.evaluate(()=>location.hash),hash);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const targetMounted=await page.$('#worker-channel-title')!==null,privateMounted=await page.$('#identity-access-title')!==null;assert.equal(targetMounted,false);assert.equal(privateMounted,false);history.push({action:method,hash,targetMounted,privateMounted});}\n const network=destinationNetwork(current);assert.deepEqual(network,beforeHistory);assert.equal(network.workspaceGets,3);assert.equal(network.participantGets,1);const oldFactsVisible=await page.evaluate(()=>/Persona de ensayo|Titular propio WhatsApp A|MUST NEVER RENDER|Tarea operativa p-a/.test(document.body.innerText));assert.equal(oldFactsVisible,false);assert.equal(await page.$('form'),null);const screenshot=await destinationScreenshot(page,'revoked',width);\n destinationChecks.push({name:destinationNames[3],width,status:'PASS',initialPath:destinationEntry,initialGeometry,denialCode:current.denialCode,history,oldFactsVisible,activationControls:await noDestinationActivation(page),...network,screenshot});await context.close();\n}\n\n"
        },
        {
          "currentOffsetCharacters": 73953,
          "previousText": "",
          "currentText": " assert.equal(checks.length,103,'Historical identity UI ledger must stay103');\n for(const width of [320,390,768,1280]){await destinationDelayedMount(width);await destinationGuideHistory(width);await destinationContextChange(width);await destinationRevokedAccess(width);}\n assert.equal(destinationChecks.length,16);assert.deepEqual(destinationChecks.map(row=>[row.width,row.name]),[320,390,768,1280].flatMap(width=>destinationNames.map(name=>[width,name])));\n"
        },
        {
          "currentOffsetCharacters": 74871,
          "previousText": " resultProof={status:'PASS',environment:'isolated-browser-real-components-with-controlled-session-and-http',...identityBefore,widths:[320,390,768,1280],totalCheckCount:checks.length,checks,sourceManifest,harnessSha256,pageErrors,requestErrors,screenshots,actualPageReloadTested:true,nativeIndexedDbReceiptReferencesTested:true,automaticRecoveryPostCount:0,postgresExecuted:false,realClerkLogin:false,realEmailDelivery:false,productionDataWritten:false,realProviderCalls:0,physicalWhatsAppVerified:false};\n",
          "currentText": " resultProof={status:'PASS',environment:'isolated-browser-real-components-with-controlled-session-and-http',...identityBefore,widths:[320,390,768,1280],totalCheckCount:checks.length,checks,sourceManifest,harnessSha256,pageErrors,requestErrors,screenshots,actualPageReloadTested:true,nativeIndexedDbReceiptReferencesTested:true,automaticRecoveryPostCount:0,postgresExecuted:false,realClerkLogin:false,realEmailDelivery:false,productionDataWritten:false,realProviderCalls:0,physicalWhatsAppVerified:false,destinationNavigation:{version:1,widths:[320,390,768,1280],totalCheckCount:destinationChecks.length,checks:destinationChecks,limits:{syntheticSession:true,controlledHttp:true,realProviderCalls:0,productionDataWritten:false,realIdentityApproved:false}},combinedTotalCheckCount:checks.length+destinationChecks.length};\n"
        },
        {
          "currentOffsetCharacters": 75876,
          "previousText": " writeFileSync(path.join(evidence,'browser-failure.json'),JSON.stringify({status:'FAILED',message:error.message,checks,pageErrors,requestErrors,serverLog,active:active?{width:active.width,mode:active.current.mode,requests:active.current.requests,posts:active.current.posts.map(row=>({operationId:row.operationId,scope:row.scope,projectId:row.projectId})),dom}:null},null,2));throw error;\n",
          "currentText": " writeFileSync(path.join(evidence,'browser-failure.json'),JSON.stringify({status:'FAILED',message:error.message,checks,pageErrors,requestErrors,serverLog,destinationChecks,active:active?{width:active.width,mode:active.current.mode,destinationAppendObservation:active.current.destinationAppendObservation||null,destinationGeometryObservation:active.current.destinationGeometryObservation||null,requests:active.current.requests,posts:active.current.posts.map(row=>({operationId:row.operationId,scope:row.scope,projectId:row.projectId})),dom}:null},null,2));throw error;\n"
        },
        {
          "currentOffsetCharacters": 77293,
          "previousText": "  writeFileSync(path.join(evidence,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({status:'PASS',checks:checks.length,pageErrors:pageErrors.length,requestErrors:requestErrors.length,evidence:path.join(evidence,'browser.json')}));\n",
          "currentText": "  writeFileSync(path.join(evidence,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({status:'PASS',checks:checks.length,destinationChecks:destinationChecks.length,combinedChecks:checks.length+destinationChecks.length,pageErrors:pageErrors.length,requestErrors:requestErrors.length,evidence:path.join(evidence,'browser.json')}));\n"
        }
      ]
    },
    "producerDelta": {
      "id": "identity-only-ui",
      "producer": "scripts/verify-workspace-identity-only-ui.mjs",
      "path": ".vercel/workspace-identity-only-evidence/browser.json",
      "previousProducerSha256": "e11ed3c52c998f84c0e7ed21ebbe806a1aa8816007b7819203e7d6c4ef4add19",
      "currentProducerSha256": "9e236a07c14417f23209a889de850820810f2ea978c1d44a4fe94688869ff3d8"
    },
    "sourceDelta": {
      "id": "identity-only-ui",
      "family": "UI_IDENTITY_ONLY",
      "previousCount": 149,
      "previousPathsSha256": "b10d37cab7e7bcf5c549a5c4af269495c2df6bfc0b6ef038d4456cbe2bcb776c",
      "currentCount": 151,
      "currentPathsSha256": "0003ee7f4ccd7a1e60f8c4d2bb1135c330a9a51fb5079796b1ebe1adfa4e7411",
      "additions": [
        "src/app/(identity)/cuenta/onboarding-guide.js",
        "src/app/(identity)/cuenta/onboarding-guide.module.css"
      ]
    },
    "historicalCheckCount": 103,
    "historicalCheckNamesSha256": "202e8d5a761476cf756a6e62a25e549e708cdc32814cb6dfd2fce309281a7268",
    "supplementalCheckCount": 16,
    "combinedTotalCheckCount": 119,
    "widths": [
      320,
      390,
      768,
      1280
    ],
    "caseNames": [
      "private-destination-initial-hash-held-canonical-mount-focus",
      "private-destination-visible-guide-same-hash-and-browser-history",
      "private-destination-context-change-cancels-held-private-mount",
      "private-destination-revoked-canonical-access-and-history-stay-closed"
    ],
    "copyGraphAdditions": [
      "src/app/(identity)/cuenta/onboarding-guide.js"
    ],
    "retainedScreenshots": [
      {
        "path": ".vercel/workspace-identity-only-evidence/destination-delayed-320.png",
        "width": 320
      },
      {
        "path": ".vercel/workspace-identity-only-evidence/destination-guide-history-append-320.png",
        "width": 320
      },
      {
        "path": ".vercel/workspace-identity-only-evidence/destination-context-320.png",
        "width": 320
      },
      {
        "path": ".vercel/workspace-identity-only-evidence/destination-revoked-320.png",
        "width": 320
      },
      {
        "path": ".vercel/workspace-identity-only-evidence/destination-delayed-390.png",
        "width": 390
      },
      {
        "path": ".vercel/workspace-identity-only-evidence/destination-guide-history-append-390.png",
        "width": 390
      },
      {
        "path": ".vercel/workspace-identity-only-evidence/destination-context-390.png",
        "width": 390
      },
      {
        "path": ".vercel/workspace-identity-only-evidence/destination-revoked-390.png",
        "width": 390
      },
      {
        "path": ".vercel/workspace-identity-only-evidence/destination-delayed-768.png",
        "width": 768
      },
      {
        "path": ".vercel/workspace-identity-only-evidence/destination-guide-history-append-768.png",
        "width": 768
      },
      {
        "path": ".vercel/workspace-identity-only-evidence/destination-context-768.png",
        "width": 768
      },
      {
        "path": ".vercel/workspace-identity-only-evidence/destination-revoked-768.png",
        "width": 768
      },
      {
        "path": ".vercel/workspace-identity-only-evidence/destination-delayed-1280.png",
        "width": 1280
      },
      {
        "path": ".vercel/workspace-identity-only-evidence/destination-guide-history-append-1280.png",
        "width": 1280
      },
      {
        "path": ".vercel/workspace-identity-only-evidence/destination-context-1280.png",
        "width": 1280
      },
      {
        "path": ".vercel/workspace-identity-only-evidence/destination-revoked-1280.png",
        "width": 1280
      }
    ]
  },
  "nativeOrBrowserAcceptance": false
});
deepFreeze(IDENTITY_DESTINATION_UX_CURRENT_REVISION);
function identityDestinationUxSection(contract){
 if(!plain(contract)||!Object.hasOwn(contract,IDENTITY_DESTINATION_UX_CURRENT_SECTION))return null;
 const value=contract[IDENTITY_DESTINATION_UX_CURRENT_SECTION];exact(value,[...Object.keys(IDENTITY_DESTINATION_UX_CURRENT_REVISION),'validationSources'],'Exact identity destination UX companion required');
 for(const[key,expected]of Object.entries(IDENTITY_DESTINATION_UX_CURRENT_REVISION))reject(same(value[key],expected),'Unreviewed identity destination UX declaration: '+key);
 reject(Array.isArray(value.validationSources)&&same(value.validationSources.map(row=>row?.path),value.validationPredecessors.map(row=>row.path)),'Exact identity destination validators required');
 for(const row of value.validationSources){exact(row,['path','sha256'],'Exact identity destination validation reference required');reject(hash(row.sha256),'Identity destination validation hash required');}return value;
}
function identityDestinationUxReferences(value){const p=value.browser.producerDelta;return [...value.reviewedSourceChanges,{path:p.producer,previousSha256:p.previousProducerSha256,currentSha256:p.currentProducerSha256},...value.validationPredecessors.map(row=>({path:row.path,previousSha256:row.sha256,currentSha256:value.validationSources.find(ref=>ref.path===row.path).sha256}))];}
export function restoreIdentityDestinationUxPreviousContract(contract){
 contract=restoreWorksiteLiveHoursPreviousContract(contract);
 const value=identityDestinationUxSection(contract);if(!value)return contract;const previous=structuredClone(contract);delete previous[IDENTITY_DESTINATION_UX_CURRENT_SECTION];
 const delta=value.browser.producerDelta,proofs=previous.extension?.proofs?.filter(row=>row.id===delta.id),records=previous.evidenceProducers?.filter(row=>row.path===delta.path&&row.producer===delta.producer);
 reject(proofs?.length===1&&records?.length===1&&proofs[0].producer===delta.producer&&proofs[0].path===delta.path&&proofs[0].producerSha256===delta.currentProducerSha256&&records[0].producerSha256===delta.currentProducerSha256,'Exact current identity destination producer required');
 reject(proofs[0].checkNames.length===value.browser.historicalCheckCount&&sha(JSON.stringify(proofs[0].checkNames))===value.browser.historicalCheckNamesSha256,'The exact historical103 identity ledger must stay unchanged');
 proofs[0].producerSha256=delta.previousProducerSha256;records[0].producerSha256=delta.previousProducerSha256;
 proofs[0].sourceFiles=previousPaths(proofs[0].sourceFiles,value.browser.sourceDelta);
 reject(sha(JSON.stringify(previous,null,2)+'\n')===value.previousContractSha256,'The complete published8c306 contract must restore exactly');return previous;
}
export function identityDestinationUxCurrentSourcePin(contract,ref){
 ref={...ref,sha256:worksiteLiveHoursPreviousSourcePin(contract,ref)};
 const value=identityDestinationUxSection(contract),row=value&&identityDestinationUxReferences(value).find(row=>row.path===ref.path);
 if(row)reject([row.previousSha256,row.currentSha256].includes(ref.sha256),'Only exact published8c306 or identity destination pins may advance: '+ref.path);
 return worksiteLiveHoursCurrentSourcePin(contract,{...ref,sha256:row?row.currentSha256:ref.sha256});
}
export function identityDestinationUxPreviousSourcePin(contract,ref){ref={...ref,sha256:worksiteLiveHoursPreviousSourcePin(contract,ref)};const value=identityDestinationUxSection(contract),row=value&&identityDestinationUxReferences(value).find(row=>row.path===ref.path);return row&&ref.sha256===row.currentSha256?row.previousSha256:ref.sha256;}
// Source-history projection for the explicit historical producer test only.
// Current gates always read the original current bytes through readSource.
export function restoreIdentityDestinationUxPreviousProducerText(contract,producer,bytes){
 if(contract[WORKSITE_LIVE_HOURS_CURRENT_SECTION]?.producerDeltas.some(row=>row.producer===producer))bytes=restoreWorksiteLiveHoursPreviousProducerText(contract,producer,bytes);
 const value=identityDestinationUxSection(contract);reject(Boolean(value)&&producer===value.browser.producerDelta.producer&&Buffer.isBuffer(bytes),'Only the exact current identity destination producer may restore its published source');restoreIdentityDestinationUxPreviousContract(contract);const delta=value.browser.producerDelta,body=value.browser.producerSourceHistory,decoded=bytes.toString('utf8');reject(bytes.equals(Buffer.from(decoded)),'Current identity destination producer UTF-8 required');let text=decoded.replaceAll('\r\n','\n');reject(sha(text)===delta.currentProducerSha256&&Buffer.byteLength(text)===body.currentBytes,'Exact current identity destination producer body required');
 for(const hunk of body.inverseHunks.toReversed()){const offset=hunk.currentOffsetCharacters;reject(text.slice(offset,offset+hunk.currentText.length)===hunk.currentText,'An exact identity destination source inverse hunk changed');text=text.slice(0,offset)+hunk.previousText+text.slice(offset+hunk.currentText.length);}
 reject(sha(text)===delta.previousProducerSha256&&Buffer.byteLength(text)===body.previousBytes,'The entire published8c306 producer source must restore exactly');return Buffer.from(text);
}
export function verifyIdentityDestinationUxCurrentSources(contract,readSource){
 if(Object.hasOwn(contract,WORKSITE_LIVE_HOURS_CURRENT_SECTION))verifyWorksiteLiveHoursCurrentSources(contract,readSource);
 const value=identityDestinationUxSection(contract);if(!value)return null;restoreIdentityDestinationUxPreviousContract(contract);reject(typeof readSource==='function','Actual identity destination source reader required');
 const refs=identityDestinationUxReferences(value);reject(new Set(refs.map(row=>row.path)).size===refs.length,'Unique identity destination sources required');
 for(const row of refs){const bytes=readSource(row.path);reject(safe(row.path)&&Buffer.isBuffer(bytes)&&bytes.equals(Buffer.from(bytes.toString('utf8')))&&sha(bytes.toString('utf8').replaceAll('\r\n','\n'))===worksiteLiveHoursCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}),'Stale current identity destination source: '+row.path);}
 return {version:1,completePreviousContractRestored:true,previousContractSha256:value.previousContractSha256,nativeOrBrowserAcceptance:false};
}
export function identityDestinationUxProofSourceAdditions(spec){
 const live=worksiteLiveHoursProofSourceAdditions(spec);if(live.length)spec={...spec,sourceFiles:spec.sourceFiles.filter(file=>!live.includes(file))};
 const delta=IDENTITY_DESTINATION_UX_CURRENT_REVISION.browser.sourceDelta;if(spec?.id!==delta.id)return live;const files=spec.sourceFiles;
 reject(Array.isArray(files)&&new Set(files).size===files.length&&same(files,[...files].sort()),'Distinct sorted identity destination source paths required');
 if(files.length===delta.currentCount&&sha(JSON.stringify(files))===delta.currentPathsSha256){previousPaths(files,delta);return [...delta.additions,...live];}
 // An earlier phase may already have removed this outer addition; its exact
 // immutable source matrix still validates that inherited set.
 reject(files.length<delta.currentCount&&!delta.additions.some(file=>files.includes(file)),'Unknown identity destination source set');return live;
}
export function restoreIdentityDestinationUxSourceSet(family,files,contract){files=restoreWorksiteLiveHoursSourceSet(contract,family,files);const value=identityDestinationUxSection(contract);if(!value)return files;restoreIdentityDestinationUxPreviousContract(contract);return family===value.browser.sourceDelta.family?previousPaths(files,value.browser.sourceDelta):files;}

function identityDestinationRequired(ok,reason){if(!ok)throw Object.assign(new Error('Identity destination browser proof rejected: '+reason),{code:'IDENTITY_DESTINATION_UX_PROOF_REJECTED',reason});}
function identityDestinationKeys(value,keys,reason){identityDestinationRequired(plain(value)&&same(Object.keys(value).sort(),keys.slice().sort()),reason);}
const identityDestinationNetworkKeys=['apiSequence','workspaceGets','participantGets','workerChannelGets','totalPosts','participantPosts','channelPosts'];
function identityDestinationExpectedSequence(mode){const row=(path,actor='A',projectId=null)=>({path:'/api/identity/'+path,method:'GET',actor,projectId}),initial=[row('workspace'),row('workspace','A','p-a'),row('participants','A','p-a')];return mode==='before'?initial.slice(0,2):mode==='context'?[...initial.slice(0,2),row('workspace','B')]:mode==='history'?[...initial,row('workspace','A','p-a'),row('workspace','A','p-a')]:mode==='revoked'?[...initial,row('workspace','A','p-a')]:initial;}
function identityDestinationNetwork(value,mode){
 const expected=identityDestinationExpectedSequence(mode),r=identityDestinationRequired;for(const row of value.apiSequence||[])identityDestinationKeys(row,['path','method','actor','projectId'],'API_ROW');
 r(same(value.apiSequence,expected)&&value.workspaceGets===expected.filter(row=>row.path==='/api/identity/workspace').length&&value.participantGets===expected.filter(row=>row.path==='/api/identity/participants').length,'API_SEQUENCE');
 r(['workerChannelGets','totalPosts','participantPosts','channelPosts'].every(key=>value[key]===0),'NO_AUTOMATIC_CHANNEL_OR_BUSINESS_IO');
}
function identityDestinationGeometry(value,width,id){
 const r=identityDestinationRequired;identityDestinationKeys(value,['id','visible','focused','left','top','right','bottom','width','height','viewportWidth','viewportHeight','documentWidth','detailsOpen','screen','screenHidden','otherPrivateScreenHidden'],'GEOMETRY_SHAPE');
 r(value.id===id&&value.visible===true&&value.focused===true&&value.viewportWidth===width&&value.viewportHeight===1050,'VISIBLE_FOCUSED_DESTINATION');
 r(['left','top','right','bottom','width','height','documentWidth'].every(key=>Number.isFinite(value[key]))&&value.width>0&&value.height>0&&value.left>=0&&value.right<=width+1&&value.right>value.left&&value.bottom>value.top&&Math.abs(value.right-value.left-value.width)<=1&&Math.abs(value.bottom-value.top-value.height)<=1&&value.top<1050&&value.bottom>0&&value.documentWidth>0&&value.documentWidth<=width,'VIEWPORT_GEOMETRY');
 r(value.detailsOpen===null&&value.screen===(id==='worker-channel-title'?'mi-whatsapp':'identidad')&&value.screenHidden===false&&value.otherPrivateScreenHidden===true,'EXACT_VISIBLE_PRIVATE_SCREEN');
}
function identityDestinationScreenshot(ref,expected,readEvidence){
 const r=identityDestinationRequired;identityDestinationKeys(ref,['path','sha256','width','height'],'SCREENSHOT_SHAPE');r(ref.path===expected.path&&hash(ref.sha256)&&ref.width===expected.width&&Number.isSafeInteger(ref.height)&&ref.height>0,'SCREENSHOT_IDENTITY');
 let bytes;try{bytes=readEvidence(ref.path);}catch{}r(Buffer.isBuffer(bytes)&&bytes.length>=24&&sha(bytes)===ref.sha256&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR'&&bytes.readUInt32BE(16)===ref.width&&bytes.readUInt32BE(20)===ref.height,'SCREENSHOT_BYTES');
}
function identityDestinationAppendObservation(event,phase,width){
 const r=identityDestinationRequired;identityDestinationKeys(event,['activeId','activeTagName','scrollY','taskCount','buttonMounted','buttonDisabled','rect','viewportWidth','viewportHeight','firstTaskTop'],'APPEND_OBSERVATION');const focus=event.activeTagName==='BUTTON'&&event.activeId==='schedule-load-more',body=event.activeTagName==='BODY'&&event.activeId==='';r((phase==='before'?focus:focus||body)&&Number.isFinite(event.scrollY)&&event.scrollY>=0&&event.taskCount===(phase==='after'?2:1)&&event.buttonMounted===true&&event.buttonDisabled===(phase==='pending')&&event.viewportWidth===width&&event.viewportHeight===1050&&Number.isFinite(event.firstTaskTop),'APPEND_NATIVE_FOCUS_AND_TASKS');
 const box=event.rect;identityDestinationKeys(box,['left','top','right','bottom','width','height'],'APPEND_RECT_SHAPE');r(Object.values(box).every(Number.isFinite)&&box.width>0&&box.height>0&&box.right>box.left&&box.bottom>box.top&&Math.abs(box.right-box.left-box.width)<=1&&Math.abs(box.bottom-box.top-box.height)<=1,'APPEND_RECT');if(phase!=='after')r(box.left>=0&&box.right<=width+1&&box.top<1050&&box.bottom>0,'APPEND_BUTTON_VISIBLE_DURING_GET');
}
export function validateIdentityDestinationUxBrowserSupplement(proof,contract,{readSource,readEvidence}){
 const value=identityDestinationUxSection(contract);if(!value)return proof;const n=value.browser,r=identityDestinationRequired,k=identityDestinationKeys,s=proof.destinationNavigation;
 k(s,['version','widths','totalCheckCount','checks','limits'],'SUPPLEMENT_SHAPE');r(s.version===1&&same(s.widths,n.widths)&&s.totalCheckCount===16&&Array.isArray(s.checks)&&s.checks.length===16&&proof.combinedTotalCheckCount===119,'SUPPLEMENT_MATRIX');
 const limits={syntheticSession:true,controlledHttp:true,realProviderCalls:0,productionDataWritten:false,realIdentityApproved:false};k(s.limits,Object.keys(limits),'SUPPLEMENT_LIMITS_SHAPE');r(same(s.limits,limits),'SUPPLEMENT_LIMITS');
 r(typeof readSource==='function'&&typeof readEvidence==='function','ACTUAL_SOURCE_AND_SCREENSHOT_READERS');verifyIdentityDestinationUxCurrentSources(contract,readSource);
 const producer=readSource(n.producerDelta.producer);r(Buffer.isBuffer(producer)&&sha(producer)===proof.harnessSha256,'ACTUAL_CURRENT_HARNESS');
 const currentSpec=contract.extension.proofs.find(row=>row.kind===n.sourceDelta.family);r(Boolean(currentSpec)&&Array.isArray(currentSpec.sourceFiles)&&Array.isArray(proof.sourceManifest)&&proof.sourceManifest.length===currentSpec.sourceFiles.length,'ACTUAL_CURRENT_SOURCE_MANIFEST');const paths=[];for(const ref of proof.sourceManifest){k(ref,['path','sha256'],'SOURCE_REFERENCE');r(safe(ref.path)&&hash(ref.sha256),'SOURCE_REFERENCE');const bytes=readSource(ref.path);r(Buffer.isBuffer(bytes)&&sha(bytes)===ref.sha256,'CURRENT_SOURCE_BYTES');paths.push(ref.path);}r(new Set(paths).size===paths.length,'EXACT_CURRENT_SOURCE_SET');const ordered=paths.slice().sort();
 let previousPaths;try{previousPaths=restoreWorksiteLiveHoursSourceSet(contract,n.sourceDelta.family,ordered);}catch(error){if(error.code==='HOME_DECISIONS_CURRENT_CI_LINEAGE_REJECTED')r(false,'EXACT_CURRENT_SOURCE_SET');throw error;}r(previousPaths.length===n.sourceDelta.currentCount&&sha(JSON.stringify(previousPaths))===n.sourceDelta.currentPathsSha256,'EXACT_HISTORICAL_SOURCE_SET');
 const common=['name','width','status','activationControls',...identityDestinationNetworkKeys,'screenshot'];
 for(const[index,row]of s.checks.entries()){
  const mode=index%4,width=n.widths[Math.floor(index/4)];r(row?.name===n.caseNames[mode]&&row.width===width&&row.status==='PASS'&&row.activationControls===0,'ORDERED_CURRENT_CASE');
  if(mode===0){k(row,[...common,'trigger','initialPath','beforeRelease','geometry','profileRead'],'INITIAL_CASE_SHAPE');r(row.trigger==='INITIAL_HASH_AND_CANONICAL_PROJECT_HINT'&&row.initialPath==='/?obra=p-a#worker-channel-title','INITIAL_TRIGGER');k(row.beforeRelease,['targetMounted','focused','heldCanonicalCount',...identityDestinationNetworkKeys],'HELD_CANONICAL_SHAPE');r(row.beforeRelease.targetMounted===false&&row.beforeRelease.focused===false&&row.beforeRelease.heldCanonicalCount===1,'HELD_CANONICAL_BEFORE_RENDER');identityDestinationNetwork(row.beforeRelease,'before');identityDestinationNetwork(row,'initial');identityDestinationGeometry(row.geometry,width,'worker-channel-title');k(row.profileRead,['heldBeforeNavigation','releasedAfterNavigation','beforeGeometry','afterGeometry'],'DELAYED_PROFILE_SHAPE');r(row.profileRead.heldBeforeNavigation===true&&row.profileRead.releasedAfterNavigation===true,'DELAYED_PROFILE_OBSERVED');for(const phase of ['beforeGeometry','afterGeometry'])identityDestinationGeometry(row.profileRead[phase],width,'worker-channel-title');r(same(row.geometry,row.profileRead.afterGeometry),'DELAYED_PROFILE_FINAL_GEOMETRY');}
  if(mode===1){
   k(row,[...common,'trigger','history','requestCountBefore','requestCountAfter','navigationNetwork','append','draftPreservation'],'GUIDE_CASE_SHAPE');r(row.trigger==='REAL_ONBOARDING_GUIDE'&&row.requestCountBefore===3&&row.requestCountAfter===3,'REAL_GUIDE_NO_AUTOMATIC_IO');k(row.navigationNetwork,identityDestinationNetworkKeys,'NAVIGATION_NETWORK_SHAPE');identityDestinationNetwork(row.navigationNetwork,'initial');identityDestinationNetwork(row,'history');
   const actions=['guide-private','same-hash-reopen','guide-identity','back','forward','back-final'],ids=['worker-channel-title','worker-channel-title','participant-title','worker-channel-title','participant-title','worker-channel-title'];r(Array.isArray(row.history)&&row.history.length===6,'HISTORY_MATRIX');for(const[i,event]of row.history.entries()){k(event,['action','hash','geometry'],'HISTORY_ROW');r(event.action===actions[i]&&event.hash==='#'+ids[i],'HISTORY_TRANSITION');identityDestinationGeometry(event.geometry,width,ids[i]);}
   const d=row.draftPreservation;k(d,['syntheticImagesOnly','submitted','before','hidden','after'],'DRAFT_PRESERVATION_SHAPE');r(d.syntheticImagesOnly===true&&d.submitted===false,'LOCAL_SYNTHETIC_DRAFT_ONLY');for(const phase of ['before','hidden','after']){const event=d[phase];k(event,['step','consent','formMounted','formVisible','sameForm','imageCount','sameImages'],'DRAFT_OBSERVATION');r(event.step===3&&event.consent===true&&event.formMounted===true&&event.formVisible===(phase!=='hidden')&&event.sameForm===true&&event.imageCount===2&&event.sameImages===true,'DRAFT_IMAGES_AND_CONSENT_PRESERVED');}
   const a=row.append;k(a,['canonicalAdmissionSimulated','totalTasks','projectReads','before','pending','after'],'APPEND_SHAPE');r(a.canonicalAdmissionSimulated===true&&a.totalTasks===3&&same(a.projectReads,[{actor:'A',projectId:'p-a',afterTask:null},{actor:'A',projectId:'p-a',afterTask:'t-p-a'}]),'ACTUAL_APPEND_CURSOR');for(const phase of ['before','pending','after'])identityDestinationAppendObservation(a[phase],phase,width);r(Math.abs(a.pending.rect.top-a.before.rect.top)<=3&&Math.abs(a.pending.rect.left-a.before.rect.left)<=3,'APPEND_VIEWPORT_ANCHOR_DURING_GET');
  }
  if(mode===2){k(row,[...common,'initialPath','heldBeforeContextChange','releasedAfterContextChange','currentActor','targetMounted','privateMounted','oldFactsVisible'],'CONTEXT_CASE_SHAPE');r(row.initialPath==='/?obra=p-a#worker-channel-title'&&row.heldBeforeContextChange===true&&row.releasedAfterContextChange===true&&row.currentActor==='B'&&row.targetMounted===false&&row.privateMounted===false&&row.oldFactsVisible===false,'CONTEXT_CANCELLATION');identityDestinationNetwork(row,'context');}
  if(mode===3){k(row,[...common,'initialPath','initialGeometry','denialCode','history','oldFactsVisible'],'REVOKED_CASE_SHAPE');r(row.initialPath==='/?obra=p-a#worker-channel-title'&&row.denialCode==='WORKSPACE_MEMBERSHIP_REQUIRED'&&row.oldFactsVisible===false,'CANONICAL_REVOCATION');identityDestinationGeometry(row.initialGeometry,width,'worker-channel-title');r(Array.isArray(row.history)&&row.history.length===2,'REVOKED_HISTORY_MATRIX');for(const[i,event]of row.history.entries()){k(event,['action','hash','targetMounted','privateMounted'],'REVOKED_HISTORY_ROW');r(event.action===['goBack','goForward'][i]&&event.hash===['#participant-title','#worker-channel-title'][i]&&event.targetMounted===false&&event.privateMounted===false,'REVOKED_TARGET_STAYS_CLOSED');}identityDestinationNetwork(row,'revoked');}
  identityDestinationScreenshot(row.screenshot,n.retainedScreenshots[index],readEvidence);
 }
 const previous={...proof};delete previous.destinationNavigation;delete previous.combinedTotalCheckCount;return previous;
}
// Validator-only fixtures remain in memory. They never emit or retag browser
// evidence and do not certify actual UI, a customer session or identity.
export function identityDestinationUxBrowserShadow(contract){
 const value=identityDestinationUxSection(contract);if(!value)return {fields:{},evidence:new Map()};const n=value.browser,evidence=new Map(),network=mode=>{const apiSequence=identityDestinationExpectedSequence(mode);return {apiSequence,workspaceGets:apiSequence.filter(row=>row.path==='/api/identity/workspace').length,participantGets:apiSequence.filter(row=>row.path==='/api/identity/participants').length,workerChannelGets:0,totalPosts:0,participantPosts:0,channelPosts:0};},geometry=(width,id='worker-channel-title')=>({id,visible:true,focused:true,left:12,top:100,right:width-12,bottom:130,width:width-24,height:30,viewportWidth:width,viewportHeight:1050,documentWidth:width,detailsOpen:null,screen:id==='worker-channel-title'?'mi-whatsapp':'identidad',screenHidden:false,otherPrivateScreenHidden:true});
 const checks=[];for(const width of n.widths)for(let mode=0;mode<4;mode++){
  const index=checks.length,png=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.write('IHDR',12);png.writeUInt32BE(width,16);png.writeUInt32BE(1050,20);const screenshot={...n.retainedScreenshots[index],sha256:sha(png),height:1050};evidence.set(screenshot.path,png);
  const common={name:n.caseNames[mode],width,status:'PASS',activationControls:0,...network(['initial','history','context','revoked'][mode]),screenshot};
  if(mode===0)checks.push({...common,trigger:'INITIAL_HASH_AND_CANONICAL_PROJECT_HINT',initialPath:'/?obra=p-a#worker-channel-title',beforeRelease:{targetMounted:false,focused:false,heldCanonicalCount:1,...network('before')},geometry:geometry(width),profileRead:{heldBeforeNavigation:true,releasedAfterNavigation:true,beforeGeometry:geometry(width),afterGeometry:geometry(width)}});
  if(mode===1){const actions=['guide-private','same-hash-reopen','guide-identity','back','forward','back-final'],ids=['worker-channel-title','worker-channel-title','participant-title','worker-channel-title','participant-title','worker-channel-title'],observation=phase=>{const top=phase==='after'?1300:phase==='pending'?902:900;return {activeId:phase==='before'?'schedule-load-more':'',activeTagName:phase==='before'?'BUTTON':'BODY',scrollY:phase==='pending'?1569:500,taskCount:phase==='after'?2:1,buttonMounted:true,buttonDisabled:phase==='pending',rect:{left:12,top,right:width-12,bottom:top+44,width:width-24,height:44},viewportWidth:width,viewportHeight:1050,firstTaskTop:1000};},draft=formVisible=>({step:3,consent:true,formMounted:true,formVisible,sameForm:true,imageCount:2,sameImages:true});checks.push({...common,trigger:'REAL_ONBOARDING_GUIDE',history:actions.map((action,i)=>({action,hash:'#'+ids[i],geometry:geometry(width,ids[i])})),requestCountBefore:3,requestCountAfter:3,navigationNetwork:network('initial'),draftPreservation:{syntheticImagesOnly:true,submitted:false,before:draft(true),hidden:draft(false),after:draft(true)},append:{canonicalAdmissionSimulated:true,totalTasks:3,projectReads:[{actor:'A',projectId:'p-a',afterTask:null},{actor:'A',projectId:'p-a',afterTask:'t-p-a'}],before:observation('before'),pending:observation('pending'),after:observation('after')}});}
  if(mode===2)checks.push({...common,initialPath:'/?obra=p-a#worker-channel-title',heldBeforeContextChange:true,releasedAfterContextChange:true,currentActor:'B',targetMounted:false,privateMounted:false,oldFactsVisible:false});
  if(mode===3)checks.push({...common,initialPath:'/?obra=p-a#worker-channel-title',initialGeometry:geometry(width),denialCode:'WORKSPACE_MEMBERSHIP_REQUIRED',history:[{action:'goBack',hash:'#participant-title',targetMounted:false,privateMounted:false},{action:'goForward',hash:'#worker-channel-title',targetMounted:false,privateMounted:false}],oldFactsVisible:false});
 }
 return {fields:{destinationNavigation:{version:1,widths:[...n.widths],totalCheckCount:16,checks,limits:{syntheticSession:true,controlledHttp:true,realProviderCalls:0,productionDataWritten:false,realIdentityApproved:false}},combinedTotalCheckCount:119},evidence,boundary:'VALIDATOR_ONLY_NOT_BROWSER_EXECUTION'};
}
