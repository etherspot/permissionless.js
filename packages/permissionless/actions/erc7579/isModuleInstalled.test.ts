import {
    http,
    type Chain,
    type Transport,
    encodeAbiParameters,
    encodePacked,
    zeroAddress
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { describe, expect } from "vitest"
import { testWithRpc } from "../../../permissionless-test/src/testWithRpc"
import {
    getCoreSmartAccounts,
    getPimlicoPaymasterClient
} from "../../../permissionless-test/src/utils"
import type { SmartAccount } from "../../accounts"
import { createBundlerClient } from "../../clients/createBundlerClient"
import type { SmartAccountClient } from "../../clients/createSmartAccountClient"
import { erc7579Actions } from "../../clients/decorators/erc7579"
import type { ENTRYPOINT_ADDRESS_V07_TYPE } from "../../types/entrypoint"
import { ENTRYPOINT_ADDRESS_V07 } from "../../utils"
import { installModule } from "./installModule"

describe.each(getCoreSmartAccounts())(
    "isModuleInstalled $name",
    ({ getErc7579SmartAccountClient, name }) => {
        testWithRpc.skipIf(!getErc7579SmartAccountClient)(
            "isModuleInstalled",
            async ({ rpc }) => {
                const { anvilRpc, altoRpc, paymasterRpc } = rpc

                if (!getErc7579SmartAccountClient) {
                    throw new Error("getErc7579SmartAccountClient not defined")
                }

                const privateKey = generatePrivateKey()

                const eoaAccount = privateKeyToAccount(privateKey)

                const smartClientWithoutExtend: SmartAccountClient<
                    ENTRYPOINT_ADDRESS_V07_TYPE,
                    Transport,
                    Chain,
                    SmartAccount<ENTRYPOINT_ADDRESS_V07_TYPE>
                > = await getErc7579SmartAccountClient({
                    entryPoint: ENTRYPOINT_ADDRESS_V07,
                    privateKey: privateKey,
                    altoRpc: altoRpc,
                    anvilRpc: anvilRpc,
                    paymasterClient: getPimlicoPaymasterClient({
                        entryPoint: ENTRYPOINT_ADDRESS_V07,
                        paymasterRpc
                    })
                })

                const smartClient = smartClientWithoutExtend.extend(
                    erc7579Actions({
                        entryPoint: ENTRYPOINT_ADDRESS_V07
                    })
                )

                const moduleData = encodePacked(
                    ["address"],
                    [smartClient.account.address]
                )

                const opHash = await installModule(smartClient as any, {
                    account: smartClient.account as any,
                    type: "execution",
                    address: "0xc98B026383885F41d9a995f85FC480E9bb8bB891",
                    callData: encodePacked(
                        ["address", "bytes"],
                        [
                            name === "Kernel"
                                ? zeroAddress
                                : eoaAccount.address,
                            encodeAbiParameters(
                                [{ type: "bytes" }, { type: "bytes" }],
                                [moduleData, "0x"]
                            )
                        ]
                    )
                })

                const bundlerClientV07 = createBundlerClient({
                    transport: http(altoRpc),
                    entryPoint: ENTRYPOINT_ADDRESS_V07
                })

                await bundlerClientV07.waitForUserOperationReceipt({
                    hash: opHash,
                    timeout: 100000
                })

                const isModuleInstalled = await smartClient.isModuleInstalled({
                    type: "execution",
                    address: "0xc98B026383885F41d9a995f85FC480E9bb8bB891",
                    callData: "0x"
                })

                expect(isModuleInstalled).toBe(true)
            }
        )
    }
)
