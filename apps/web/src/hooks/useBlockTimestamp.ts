"use client";

import { useBlock } from "wagmi";
import { useEffect, useState } from "react";

export function useBlockTimestamp() {
    const { data: block } = useBlock({ watch: true });
    const [timestamp, setTimestamp] = useState<bigint>(BigInt(0));

    useEffect(() => {
        if (block?.timestamp) {
            setTimestamp(block.timestamp);
        }
    }, [block]);

    // Fallback to local time if block is missing (initial load) but convert to seconds
    // This prevents UI flash of "Expired" or "1970"
    if (timestamp === BigInt(0)) {
        return BigInt(Math.floor(Date.now() / 1000));
    }

    return timestamp;
}
