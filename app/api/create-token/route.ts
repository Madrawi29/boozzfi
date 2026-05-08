import fs from "fs";
import path from "path";
import type { Abi, Hex } from "viem";
import { circleDeployContract } from "@/src/lib/circleDeploy";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, symbol } = body;

        if (!name || !symbol) {
            return Response.json(
                { error: "Token name and symbol required" },
                { status: 400 }
            );
        }

        // load artifact
        const artifactPath = path.join(
            process.cwd(),
            "artifacts",
            "BoozzToken.json"
        );

        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

        const supply = "1000000000000000000000000"; // 1,000,000 * 1e18

        const result = await circleDeployContract({
            abi: artifact.abi as Abi,
            bytecode: artifact.bytecode as Hex,
            args: [
                name,
                symbol,
                supply,
                process.env.CIRCLE_TREASURY_WALLET_ADDRESS,
            ],
        });

        return Response.json({
            message: "Deploy submitted",
            circleResponse: result,
        });
    } catch (err: unknown) {
        return Response.json(
            { error: err instanceof Error ? err.message : "Failed to deploy" },
            { status: 500 }
        );
    }
}
