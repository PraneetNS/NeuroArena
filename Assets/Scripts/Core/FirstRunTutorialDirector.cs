using System;
using UnityEngine;
using NeuroArena.Data;
using NeuroArena.UI;

namespace NeuroArena.Core
{
    public enum TutorialState
    {
        WelcomeToLinearSteppes,
        HarvestFirstCrystal,
        HeadToLabStation,
        CalibrateTerminal,
        CompletedAndHandover
    }

    /// <summary>
    /// 90-Second Guided First-Run Sequence Director.
    /// Orchestrates non-blocking mascot guidance, beacon visual attention, and pre-filled training calibration.
    /// </summary>
    public class FirstRunTutorialDirector : MonoBehaviour
    {
        public static FirstRunTutorialDirector Instance { get; private set; }

        [Header("State")]
        [SerializeField] private TutorialState currentState = TutorialState.WelcomeToLinearSteppes;
        [SerializeField] private bool isTutorialActive = true;

        public TutorialState CurrentState => currentState;
        public bool IsTutorialActive => isTutorialActive;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void Start()
        {
            if (isTutorialActive)
            {
                StartTutorial();
            }
        }

        public void StartTutorial()
        {
            isTutorialActive = true;
            currentState = TutorialState.HarvestFirstCrystal;
            MascotGuideCompanion.Instance?.Say(
                "Welcome to NeuroArena, Architect! I'm ADA. See that glowing Feature Crystal (X) ahead? Let's harvest it to collect sample data!",
                10f
            );
        }

        public void OnCrystalHarvested()
        {
            if (currentState == TutorialState.HarvestFirstCrystal)
            {
                currentState = TutorialState.HeadToLabStation;
                MascotGuideCompanion.Instance?.Say(
                    "Great extraction! That crystal contains linear gradient potential. Now follow your radar waypoint to the glowing Lab Station!",
                    10f
                );
            }
        }

        public void OnTerminalOpened()
        {
            if (currentState == TutorialState.HeadToLabStation)
            {
                currentState = TutorialState.CalibrateTerminal;
                MascotGuideCompanion.Instance?.Say(
                    "I've pre-filled your model expression (y = wx + b). Hit TRAIN to run Gradient Descent and observe the loss converge!",
                    10f
                );
            }
        }

        public void OnTrainingCompleted()
        {
            if (currentState == TutorialState.CalibrateTerminal)
            {
                currentState = TutorialState.CompletedAndHandover;
                isTutorialActive = false;
                MascotGuideCompanion.Instance?.Say(
                    "Loss converged under threshold! You have mastered the fundamentals. The entire arena is now yours to explore!",
                    12f
                );
            }
        }
    }
}
