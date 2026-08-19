using System;
using System.IO;
using UnityEngine;

namespace NeuroArena.Network
{
    public struct TickNetworkPacket
    {
        public uint tick;
        public ushort playerId;
        public Vector3 position;
        public float rotY;
        public float loss;
    }

    public static class FastBinarySerializer
    {
        public const ushort PACKET_MAGIC = 0x4e41;

        public static byte[] SerializeTick(uint tick, ushort playerId, Vector3 pos, float rotY, float loss)
        {
            byte[] buffer = new byte[28];
            using (var stream = new MemoryStream(buffer))
            using (var writer = new BinaryWriter(stream))
            {
                writer.Write(PACKET_MAGIC);
                writer.Write(tick);
                writer.Write(playerId);
                writer.Write(pos.x);
                writer.Write(pos.y);
                writer.Write(pos.z);
                writer.Write(rotY);
                writer.Write(loss);
            }
            return buffer;
        }

        public static TickNetworkPacket DeserializeTick(byte[] buffer)
        {
            if (buffer == null || buffer.Length < 28)
                throw new ArgumentException("Invalid buffer length for tick packet");

            using (var stream = new MemoryStream(buffer))
            using (var reader = new BinaryReader(stream))
            {
                ushort magic = reader.ReadUInt16();
                if (magic != PACKET_MAGIC)
                    throw new InvalidDataException("Invalid packet magic");

                return new TickNetworkPacket
                {
                    tick = reader.ReadUInt32(),
                    playerId = reader.ReadUInt16(),
                    position = new Vector3(reader.ReadSingle(), reader.ReadSingle(), reader.ReadSingle()),
                    rotY = reader.ReadSingle(),
                    loss = reader.ReadSingle()
                };
            }
        }
    }
}
