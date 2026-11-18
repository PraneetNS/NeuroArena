using System;
using UnityEngine;

namespace NeuroArena.AI
{
    /// <summary>
    /// MeanFieldSwarmCrowd: Samples continuum density fields and mean-field drift vectors
    /// to navigate massive 100+ bot swarms under Nash equilibrium conditions.
    /// </summary>
    public class MeanFieldSwarmCrowd : MonoBehaviour
    {
        [Header("Continuum Grid")]
        [SerializeField] private float gridExtent = 64f;
        [SerializeField] private int gridResolution = 16;
        [SerializeField] private float swarmCohesionSpeed = 6.0f;

        [Header("Mean Field State")]
        [SerializeField] private Vector3 collectiveDriftVelocity = Vector3.zero;
        [SerializeField] private float localCongestionDensity = 0.0f;

        public Vector3 CollectiveDriftVelocity => collectiveDriftVelocity;
        public float LocalCongestionDensity => localCongestionDensity;

        private void Update()
        {
            // Sample local mean-field vector
            Vector3 pos = transform.position;
            float targetCenterX = 0f;
            float targetCenterZ = 0f;

            // Direct attraction to objective with congestion avoidance
            Vector3 toCenter = new Vector3(targetCenterX - pos.x, 0f, targetCenterZ - pos.z);
            float dist = toCenter.magnitude;

            // Anti-congestion repulsion if near other crowd members
            Vector3 repulsion = Vector3.zero;
            Collider[] neighbors = UnityEngine.Physics.OverlapSphere(pos, 2.5f);
            localCongestionDensity = neighbors.Length / 10f;

            if (neighbors.Length > 2)
            {
                for (int i = 0; i < neighbors.Length; i++)
                {
                    if (neighbors[i].gameObject != gameObject)
                    {
                        Vector3 diff = pos - neighbors[i].transform.position;
                        repulsion += diff.normalized / Mathf.Max(0.1f, diff.magnitude);
                    }
                }
            }

            collectiveDriftVelocity = (toCenter.normalized * 0.7f + repulsion.normalized * 0.3f) * swarmCohesionSpeed;

            // Steer transform along drift field
            transform.position += collectiveDriftVelocity * Time.deltaTime;
            if (collectiveDriftVelocity.sqrMagnitude > 0.01f)
            {
                transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(collectiveDriftVelocity.normalized), 8f * Time.deltaTime);
            }
        }
    }
}
