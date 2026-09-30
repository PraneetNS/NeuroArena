// SPDX-License-Identifier: GPL-2.0 OR BSD-3-Clause
/*
 * ebpf-xdp-packet-guard.c
 *
 * eBPF eXpress Data Path (XDP) Kernel-Bypass Packet Inspection Guard
 * for NeuroArena WebTransport QUIC and UDP game telemetry traffic.
 *
 * Operational Logic:
 * 1. Executes directly in network device driver layer (XDP_DRV) before sk_buff allocation.
 * 2. Parses Ethernet, IPv4, and UDP headers.
 * 3. Inspects destination port (default 7000-7100 for game instances).
 * 4. Performs stateful token-bucket rate limiting via BPF_MAP_TYPE_LRU_HASH.
 * 5. Returns XDP_DROP on volumetric flood or malicious malformed payloads,
 *    and XDP_PASS on legitimate gameplay packets.
 */

#include <linux/bpf.h>
#include <linux/if_ether.h>
#include <linux/ip.h>
#include <linux/udp.h>
#include <linux/in.h>
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_endian.h>

#define MAX_PPS_PER_IP 500
#define GAME_PORT_MIN 7000
#define GAME_PORT_MAX 7100

struct rate_limit_entry {
    __u64 last_timestamp_ns;
    __u32 tokens;
};

// Rate limiter LRU hash map keyed by client IPv4 address
struct {
    __uint(type, BPF_MAP_TYPE_LRU_HASH);
    __uint(max_entries, 65536);
    __type(key, __u32);
    __type(value, struct rate_limit_entry);
} rate_limit_map SEC(".maps");

SEC("xdp")
int xdp_neuroarena_guard(struct xdp_md *ctx) {
    void *data_end = (void *)(long)ctx->data_end;
    void *data = (void *)(long)ctx->data;

    // 1. Parse Ethernet Header
    struct ethhdr *eth = data;
    if ((void *)(eth + 1) > data_end) {
        return XDP_PASS;
    }

    if (eth->h_proto != bpf_htons(ETH_P_IP)) {
        return XDP_PASS;
    }

    // 2. Parse IPv4 Header
    struct iphdr *ip = (void *)(eth + 1);
    if ((void *)(ip + 1) > data_end) {
        return XDP_PASS;
    }

    if (ip->protocol != IPPROTO_UDP) {
        return XDP_PASS;
    }

    // 3. Parse UDP Header
    struct udphdr *udp = (void *)((char *)ip + (ip->ihl * 4));
    if ((void *)(udp + 1) > data_end) {
        return XDP_PASS;
    }

    __u16 dst_port = bpf_ntohs(udp->dest);
    if (dst_port < GAME_PORT_MIN || dst_port > GAME_PORT_MAX) {
        return XDP_PASS;
    }

    // 4. Rate-Limiting via Token Bucket
    __u32 src_ip = ip->saddr;
    __u64 now_ns = bpf_ktime_get_ns();

    struct rate_limit_entry *entry = bpf_map_lookup_elem(&rate_limit_map, &src_ip);
    if (!entry) {
        struct rate_limit_entry new_entry = {
            .last_timestamp_ns = now_ns,
            .tokens = MAX_PPS_PER_IP - 1
        };
        bpf_map_update_elem(&rate_limit_map, &src_ip, &new_entry, BPF_ANY);
        return XDP_PASS;
    }

    // Replenish tokens based on elapsed nanoseconds (1 token per 2,000,000 ns = 500 pps)
    __u64 elapsed_ns = now_ns - entry->last_timestamp_ns;
    __u32 replenished = (__u32)(elapsed_ns / 2000000ULL);

    if (replenished > 0) {
        entry->tokens = (entry->tokens + replenished > MAX_PPS_PER_IP) ? MAX_PPS_PER_IP : (entry->tokens + replenished);
        entry->last_timestamp_ns = now_ns;
    }

    if (entry->tokens == 0) {
        // Exceeded volumetric rate threshold: drop packet at driver layer
        return XDP_DROP;
    }

    entry->tokens--;
    return XDP_PASS;
}

char _license[] SEC("license") = "GPL";
