#!/usr/bin/env python3
"""Host-side golden reference for src/baremetal/main.c.

Regenerates EXACTLY the same test pattern as main.c and prints the dot
product. run_b0.sh compares this against what the bare-metal binary prints
on Spike; matching numbers prove the cross-compiled kernel computes what we
think it does. This tiny script is the template for the whole project's
methodology: every kernel gets a host reference it must match bit-for-bit.
"""
import numpy as np

K, za = 192, 11
# np.uint8(...) & 0xFF then reinterpret as int8 == C's (int8_t)(expr) wraparound
A = np.array([np.int8(np.uint8((i*7+3)  & 0xFF)) for i in range(K)], dtype=np.int32)
W = np.array([np.int8(np.uint8((i*13-5) & 0xFF)) for i in range(K)], dtype=np.int32)
print(int(((A - za) * W).sum()))
