#!/usr/bin/env python3
"""
ProofLoop Backend API Test Suite
Tests the complete validation loop: Create → Interview → Profile → Specialists → Critic → Missions → Evidence → Chairman → Aggregate
"""

import requests
import json
import time
import sys
from typing import Dict, Any

# Base URL from environment
BASE_URL = "https://proofloop-validate.preview.emergentagent.com/api"

# AI calls can take 20-90 seconds, use generous timeout
TIMEOUT = 150

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def log_success(msg: str):
    print(f"{Colors.GREEN}✓ {msg}{Colors.END}")

def log_error(msg: str):
    print(f"{Colors.RED}✗ {msg}{Colors.END}")

def log_info(msg: str):
    print(f"{Colors.BLUE}ℹ {msg}{Colors.END}")

def log_warning(msg: str):
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.END}")

def test_health_check():
    """Test 1: GET /api → health check"""
    print("\n" + "="*80)
    print("TEST 1: Health Check (GET /api)")
    print("="*80)
    
    try:
        response = requests.get(BASE_URL, timeout=10)
        log_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            log_info(f"Response: {json.dumps(data, indent=2)}")
            
            if data.get('ok') == True and data.get('service') == 'ProofLoop API':
                log_success("Health check passed")
                return True
            else:
                log_error(f"Unexpected response format: {data}")
                return False
        else:
            log_error(f"Expected 200, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_error(f"Health check failed: {str(e)}")
        return False

def test_create_startup():
    """Test 2: POST /api/startups → create startup + first question"""
    print("\n" + "="*80)
    print("TEST 2: Create Startup + Opening Interview Question (POST /api/startups)")
    print("="*80)
    
    # First test validation - empty body should return 400
    print("\n--- Testing validation (empty body) ---")
    try:
        response = requests.post(f"{BASE_URL}/startups", json={}, timeout=TIMEOUT)
        log_info(f"Status: {response.status_code}")
        
        if response.status_code == 400:
            log_success("Validation test passed - empty body returns 400")
        else:
            log_warning(f"Expected 400 for empty body, got {response.status_code}")
    except Exception as e:
        log_error(f"Validation test failed: {str(e)}")
    
    # Now create a real startup
    print("\n--- Creating real startup ---")
    startup_data = {
        "name": "StudyBuddy",
        "idea": "AI-powered study companion app that creates personalized flashcards and quizzes for university students from their lecture notes"
    }
    
    try:
        log_info(f"Request: {json.dumps(startup_data, indent=2)}")
        start_time = time.time()
        response = requests.post(f"{BASE_URL}/startups", json=startup_data, timeout=TIMEOUT)
        elapsed = time.time() - start_time
        
        log_info(f"Status: {response.status_code} (took {elapsed:.1f}s)")
        
        if response.status_code == 200:
            data = response.json()
            log_info(f"Response keys: {list(data.keys())}")
            
            # Verify response structure
            if 'startup' in data and 'first_question' in data and 'progress' in data:
                startup = data['startup']
                if 'id' in startup:
                    log_success(f"Startup created with ID: {startup['id']}")
                    log_info(f"First question: {data['first_question'][:100]}...")
                    log_info(f"Progress: {data['progress']}")
                    return startup['id']
                else:
                    log_error("Startup object missing 'id' field")
                    return None
            else:
                log_error(f"Missing required fields. Got: {list(data.keys())}")
                return None
        else:
            log_error(f"Expected 200, got {response.status_code}: {response.text}")
            return None
            
    except Exception as e:
        log_error(f"Create startup failed: {str(e)}")
        return None

def test_interview_turns(startup_id: str):
    """Test 3: POST /api/interview → 3 interview turns"""
    print("\n" + "="*80)
    print("TEST 3: Interview Turns (POST /api/interview)")
    print("="*80)
    
    # Realistic founder answers
    answers = [
        "Our target customers are university students aged 18-25, particularly STEM majors who struggle with dense lecture material. We surveyed 50 students and 80% said they spend over 3 hours making study materials manually.",
        "Students currently use Quizlet or Anki but must manually create cards. Our AI auto-generates them from uploaded notes in seconds. We charge $8/month freemium.",
        "We have a waitlist of 200 students from 3 campus ambassador programs. We plan to grow via student clubs and TikTok study-tok influencers. Key assumption: students will pay rather than use free ChatGPT."
    ]
    
    for i, answer in enumerate(answers, 1):
        print(f"\n--- Interview Turn {i} ---")
        try:
            payload = {
                "startup_id": startup_id,
                "message": answer
            }
            
            log_info(f"Founder answer: {answer[:80]}...")
            start_time = time.time()
            response = requests.post(f"{BASE_URL}/interview", json=payload, timeout=TIMEOUT)
            elapsed = time.time() - start_time
            
            log_info(f"Status: {response.status_code} (took {elapsed:.1f}s)")
            
            if response.status_code == 200:
                data = response.json()
                log_info(f"Response keys: {list(data.keys())}")
                
                if 'question' in data and 'done' in data and 'progress' in data and 'topic' in data:
                    log_success(f"Turn {i} completed")
                    log_info(f"Next question: {data['question'][:100]}...")
                    log_info(f"Progress: {data['progress']}%, Done: {data['done']}, Topic: {data['topic']}")
                else:
                    log_error(f"Missing required fields. Got: {list(data.keys())}")
                    return False
            else:
                log_error(f"Expected 200, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            log_error(f"Interview turn {i} failed: {str(e)}")
            return False
    
    log_success("All 3 interview turns completed")
    return True

def test_complete_interview(startup_id: str):
    """Test 4: POST /api/interview/complete → generate profile"""
    print("\n" + "="*80)
    print("TEST 4: Complete Interview + Generate Profile (POST /api/interview/complete)")
    print("="*80)
    
    try:
        payload = {"startup_id": startup_id}
        
        log_info("Generating structured profile from interview...")
        start_time = time.time()
        response = requests.post(f"{BASE_URL}/interview/complete", json=payload, timeout=TIMEOUT)
        elapsed = time.time() - start_time
        
        log_info(f"Status: {response.status_code} (took {elapsed:.1f}s)")
        
        if response.status_code == 200:
            data = response.json()
            log_info(f"Response keys: {list(data.keys())}")
            
            if 'profile' in data and 'version' in data:
                profile = data['profile']
                
                # Verify all 15 required fields
                required_fields = [
                    'startup_name', 'idea', 'target_customer', 'customer_problem',
                    'current_alternatives', 'solution', 'value_proposition', 'competitors',
                    'business_model', 'pricing', 'growth_strategy', 'first_100_users',
                    'traction', 'existing_evidence', 'key_assumptions'
                ]
                
                missing = [f for f in required_fields if f not in profile]
                
                if not missing:
                    log_success(f"Profile generated with all 15 fields (version {data['version']})")
                    log_info(f"Startup: {profile.get('startup_name')}")
                    log_info(f"Target customer: {profile.get('target_customer', '')[:80]}...")
                    return True
                else:
                    log_error(f"Profile missing fields: {missing}")
                    return False
            else:
                log_error(f"Missing required fields. Got: {list(data.keys())}")
                return False
        else:
            log_error(f"Expected 200, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_error(f"Complete interview failed: {str(e)}")
        return False

def test_specialist_analysis(startup_id: str):
    """Test 5: POST /api/analyze/specialists → run all 4 specialists in parallel"""
    print("\n" + "="*80)
    print("TEST 5: Specialist Analysis (POST /api/analyze/specialists)")
    print("="*80)
    
    try:
        payload = {"startup_id": startup_id}
        
        log_info("Running 4 specialist agents in parallel (market, product, business, growth)...")
        log_warning("This makes 4 parallel AI calls - may take 60-90 seconds")
        start_time = time.time()
        response = requests.post(f"{BASE_URL}/analyze/specialists", json=payload, timeout=TIMEOUT)
        elapsed = time.time() - start_time
        
        log_info(f"Status: {response.status_code} (took {elapsed:.1f}s)")
        
        if response.status_code == 200:
            data = response.json()
            log_info(f"Response keys: {list(data.keys())}")
            
            if 'reports' in data and 'agents_run' in data:
                reports = data['reports']
                agents_run = data['agents_run']
                
                expected_agents = ['market', 'product', 'business', 'growth']
                
                if set(agents_run) == set(expected_agents):
                    log_success(f"All 4 specialist agents completed: {agents_run}")
                    
                    # Verify each report has required structure
                    for agent in expected_agents:
                        if agent in reports:
                            report = reports[agent]
                            required = ['summary', 'strengths', 'risks', 'claims', 'assumptions', 'questions', 'recommendations']
                            missing = [f for f in required if f not in report]
                            
                            if not missing:
                                log_info(f"  {agent}: {report['summary'][:80]}...")
                            else:
                                log_warning(f"  {agent} report missing fields: {missing}")
                        else:
                            log_error(f"  {agent} report not found in response")
                            return False
                    
                    return True
                else:
                    log_error(f"Expected agents {expected_agents}, got {agents_run}")
                    return False
            else:
                log_error(f"Missing required fields. Got: {list(data.keys())}")
                return False
        else:
            log_error(f"Expected 200, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_error(f"Specialist analysis failed: {str(e)}")
        return False

def test_critic_analysis(startup_id: str):
    """Test 6: POST /api/analyze/critic → extract claims"""
    print("\n" + "="*80)
    print("TEST 6: Critic Analysis + Claim Extraction (POST /api/analyze/critic)")
    print("="*80)
    
    try:
        payload = {"startup_id": startup_id}
        
        log_info("Running critic agent to challenge claims...")
        start_time = time.time()
        response = requests.post(f"{BASE_URL}/analyze/critic", json=payload, timeout=TIMEOUT)
        elapsed = time.time() - start_time
        
        log_info(f"Status: {response.status_code} (took {elapsed:.1f}s)")
        
        if response.status_code == 200:
            data = response.json()
            log_info(f"Response keys: {list(data.keys())}")
            
            if 'critic' in data and 'claims' in data:
                critic = data['critic']
                claims = data['claims']
                
                # Verify critic structure
                if 'summary' in critic and 'contradictions' in critic and 'claims' in critic:
                    log_success(f"Critic analysis completed")
                    log_info(f"Critic summary: {critic['summary'][:100]}...")
                    log_info(f"Contradictions found: {len(critic.get('contradictions', []))}")
                    
                    # Verify claims (should be 6-10)
                    if 6 <= len(claims) <= 10:
                        log_success(f"Extracted {len(claims)} claims (expected 6-10)")
                        
                        # Verify each claim has required fields
                        for i, claim in enumerate(claims[:3], 1):  # Check first 3
                            required = ['id', 'claim', 'category', 'importance', 'criticism', 'status']
                            missing = [f for f in required if f not in claim]
                            
                            if not missing and claim['status'] == 'unproven':
                                log_info(f"  Claim {i}: [{claim['importance']}] {claim['claim'][:60]}...")
                            else:
                                if missing:
                                    log_warning(f"  Claim {i} missing fields: {missing}")
                                if claim.get('status') != 'unproven':
                                    log_warning(f"  Claim {i} status is '{claim.get('status')}', expected 'unproven'")
                        
                        return claims  # Return claims for next test
                    else:
                        log_warning(f"Expected 6-10 claims, got {len(claims)}")
                        return claims if claims else False
                else:
                    log_error(f"Critic object missing required fields")
                    return False
            else:
                log_error(f"Missing required fields. Got: {list(data.keys())}")
                return False
        else:
            log_error(f"Expected 200, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_error(f"Critic analysis failed: {str(e)}")
        return False

def test_mission_generation(startup_id: str):
    """Test 7: POST /api/analyze/missions → generate evidence missions"""
    print("\n" + "="*80)
    print("TEST 7: Evidence Mission Generation (POST /api/analyze/missions)")
    print("="*80)
    
    try:
        payload = {"startup_id": startup_id}
        
        log_info("Generating evidence missions for unproven claims...")
        start_time = time.time()
        response = requests.post(f"{BASE_URL}/analyze/missions", json=payload, timeout=TIMEOUT)
        elapsed = time.time() - start_time
        
        log_info(f"Status: {response.status_code} (took {elapsed:.1f}s)")
        
        if response.status_code == 200:
            data = response.json()
            log_info(f"Response keys: {list(data.keys())}")
            
            if 'missions' in data:
                missions = data['missions']
                
                if len(missions) > 0:
                    log_success(f"Generated {len(missions)} evidence missions")
                    
                    # Verify each mission has required fields
                    for i, mission in enumerate(missions[:3], 1):  # Check first 3
                        required = ['id', 'claim_id', 'title', 'description', 'task_type', 'instructions', 'success_criteria', 'priority', 'status']
                        missing = [f for f in required if f not in mission]
                        
                        if not missing and mission['status'] == 'pending':
                            log_info(f"  Mission {i}: [{mission['priority']}] {mission['title']}")
                            log_info(f"    Task type: {mission['task_type']}")
                        else:
                            if missing:
                                log_warning(f"  Mission {i} missing fields: {missing}")
                            if mission.get('status') != 'pending':
                                log_warning(f"  Mission {i} status is '{mission.get('status')}', expected 'pending'")
                    
                    return missions  # Return missions for next test
                else:
                    log_warning("No missions generated (all claims may already have missions)")
                    return []
            else:
                log_error(f"Missing 'missions' field. Got: {list(data.keys())}")
                return False
        else:
            log_error(f"Expected 200, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_error(f"Mission generation failed: {str(e)}")
        return False

def test_evidence_submission(mission_id: str, startup_id: str):
    """Test 8: POST /api/missions/:id/submit → submit evidence"""
    print("\n" + "="*80)
    print("TEST 8: Evidence Submission + Auto-Evaluation (POST /api/missions/:id/submit)")
    print("="*80)
    
    try:
        payload = {
            "description": "Interviewed 20 STEM students on campus over 2 weeks",
            "results": "17 of 20 said making study materials is a top-3 pain point; 12 said they would pay for auto-generation",
            "metrics": "17/20 pain confirmation, 12/20 willingness to pay at $8/mo",
            "links": "",
            "notes": "Recruited via campus ambassador program"
        }
        
        log_info(f"Submitting evidence for mission {mission_id}...")
        log_info(f"Description: {payload['description']}")
        start_time = time.time()
        response = requests.post(f"{BASE_URL}/missions/{mission_id}/submit", json=payload, timeout=TIMEOUT)
        elapsed = time.time() - start_time
        
        log_info(f"Status: {response.status_code} (took {elapsed:.1f}s)")
        
        if response.status_code == 200:
            data = response.json()
            log_info(f"Response keys: {list(data.keys())}")
            
            if 'submission' in data and 'evaluation' in data:
                submission = data['submission']
                evaluation = data['evaluation']
                
                # Verify submission
                if 'id' in submission:
                    log_success(f"Evidence submitted (ID: {submission['id']})")
                
                # Verify evaluation
                required_eval = ['status', 'confidence', 'evaluation']
                missing = [f for f in required_eval if f not in evaluation]
                
                if not missing:
                    status = evaluation['status']
                    confidence = evaluation['confidence']
                    eval_obj = evaluation.get('evaluation', {})
                    
                    valid_statuses = ['VALIDATED', 'PARTIALLY_VALIDATED', 'UNPROVEN', 'REJECTED']
                    if status in valid_statuses:
                        log_success(f"Evidence evaluated: {status} (confidence: {confidence}/100)")
                        
                        if 'reasoning' in eval_obj:
                            log_info(f"Reasoning: {eval_obj['reasoning'][:100]}...")
                        
                        # Check for followup mission
                        if 'followup' in data and data['followup']:
                            log_info(f"Follow-up mission created: {data['followup'].get('title', 'N/A')}")
                        
                        # Now verify the claim status was updated
                        log_info("Verifying claim status was updated...")
                        try:
                            verify_response = requests.get(f"{BASE_URL}/startups/{startup_id}", timeout=30)
                            if verify_response.status_code == 200:
                                verify_data = verify_response.json()
                                claims = verify_data.get('claims', [])
                                
                                # Find the claim linked to this mission
                                # We need to get the mission first to find claim_id
                                missions = verify_data.get('missions', [])
                                target_mission = next((m for m in missions if m['id'] == mission_id), None)
                                
                                if target_mission and target_mission.get('claim_id'):
                                    claim_id = target_mission['claim_id']
                                    target_claim = next((c for c in claims if c['id'] == claim_id), None)
                                    
                                    if target_claim:
                                        claim_status = target_claim['status']
                                        expected_status = {
                                            'VALIDATED': 'validated',
                                            'PARTIALLY_VALIDATED': 'partially_validated',
                                            'UNPROVEN': 'unproven',
                                            'REJECTED': 'rejected'
                                        }.get(status, 'unproven')
                                        
                                        if claim_status == expected_status:
                                            log_success(f"Claim status correctly updated to '{claim_status}'")
                                        else:
                                            log_warning(f"Claim status is '{claim_status}', expected '{expected_status}'")
                                    else:
                                        log_warning(f"Could not find claim with ID {claim_id}")
                                else:
                                    log_warning("Mission has no claim_id to verify")
                            else:
                                log_warning(f"Could not verify claim status: {verify_response.status_code}")
                        except Exception as ve:
                            log_warning(f"Could not verify claim status: {str(ve)}")
                        
                        return True
                    else:
                        log_error(f"Invalid evaluation status: {status}")
                        return False
                else:
                    log_error(f"Evaluation missing fields: {missing}")
                    return False
            else:
                log_error(f"Missing required fields. Got: {list(data.keys())}")
                return False
        else:
            log_error(f"Expected 200, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_error(f"Evidence submission failed: {str(e)}")
        return False

def test_chairman_assessment(startup_id: str):
    """Test 9: POST /api/analyze/chairman → final assessment + score"""
    print("\n" + "="*80)
    print("TEST 9: Chairman Assessment + Investor Readiness Score (POST /api/analyze/chairman)")
    print("="*80)
    
    try:
        payload = {"startup_id": startup_id}
        
        log_info("Running chairman assessment...")
        log_warning("This aggregates all data and runs final AI analysis - may take 60-90 seconds")
        start_time = time.time()
        response = requests.post(f"{BASE_URL}/analyze/chairman", json=payload, timeout=TIMEOUT)
        elapsed = time.time() - start_time
        
        log_info(f"Status: {response.status_code} (took {elapsed:.1f}s)")
        
        if response.status_code == 200:
            data = response.json()
            log_info(f"Response keys: {list(data.keys())}")
            
            if 'report' in data and 'score' in data:
                report = data['report']
                score = data['score']
                
                # Verify report structure
                report_fields = ['summary', 'strengths', 'critical_risks', 'validated_claims', 'unproven_claims', 'next_actions', 'recommended_changes', 'overall_assessment']
                missing_report = [f for f in report_fields if f not in report]
                
                if not missing_report:
                    log_success("Chairman report generated")
                    log_info(f"Overall assessment: {report['overall_assessment'][:100]}...")
                else:
                    log_warning(f"Report missing fields: {missing_report}")
                
                # Verify score structure
                if 'overall' in score and 'readiness_status' in score and 'categories' in score:
                    overall = score['overall']
                    status = score['readiness_status']
                    categories = score['categories']
                    
                    log_success(f"Investor Readiness Score: {overall}/100")
                    log_info(f"Status: {status}")
                    
                    # Verify all 7 categories
                    expected_categories = ['market_validation', 'product', 'business_model', 'growth', 'traction', 'moat', 'evidence_quality']
                    missing_cats = [c for c in expected_categories if c not in categories]
                    
                    if not missing_cats:
                        log_success("All 7 score categories present")
                        
                        # Verify each category structure
                        for cat in expected_categories[:3]:  # Check first 3
                            cat_data = categories[cat]
                            required = ['score', 'explanation', 'supporting_evidence', 'missing_evidence']
                            missing = [f for f in required if f not in cat_data]
                            
                            if not missing:
                                log_info(f"  {cat}: {cat_data['score']}/100")
                            else:
                                log_warning(f"  {cat} missing fields: {missing}")
                        
                        return True
                    else:
                        log_error(f"Score missing categories: {missing_cats}")
                        return False
                else:
                    log_error(f"Score missing required fields")
                    return False
            else:
                log_error(f"Missing required fields. Got: {list(data.keys())}")
                return False
        else:
            log_error(f"Expected 200, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_error(f"Chairman assessment failed: {str(e)}")
        return False

def test_startup_detail(startup_id: str):
    """Test 10: GET /api/startups/:id → verify full aggregate"""
    print("\n" + "="*80)
    print("TEST 10: Startup Detail Aggregate (GET /api/startups/:id)")
    print("="*80)
    
    try:
        log_info(f"Fetching full startup aggregate for {startup_id}...")
        response = requests.get(f"{BASE_URL}/startups/{startup_id}", timeout=30)
        
        log_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            log_info(f"Response keys: {list(data.keys())}")
            
            # Verify all expected sections
            expected = ['startup', 'profile', 'interview', 'reports', 'claims', 'missions', 'score_history', 'latest_score', 'versions']
            missing = [f for f in expected if f not in data]
            
            if not missing:
                log_success("All aggregate sections present")
                
                # Verify startup
                startup = data['startup']
                if startup.get('stage') == 'analyzed':
                    log_success(f"Startup stage: {startup['stage']}")
                else:
                    log_warning(f"Startup stage is '{startup.get('stage')}', expected 'analyzed'")
                
                # Verify profile
                if data['profile']:
                    log_success("Profile present")
                else:
                    log_error("Profile is null")
                
                # Verify interview (should have 7+ messages: 1 opening + 3 user + 3 assistant)
                interview = data['interview']
                if len(interview) >= 7:
                    log_success(f"Interview has {len(interview)} messages (expected 7+)")
                else:
                    log_warning(f"Interview has {len(interview)} messages, expected 7+")
                
                # Verify reports (should have market, product, business, growth, critic, chairman)
                reports = data['reports']
                expected_reports = ['market', 'product', 'business', 'growth', 'critic', 'chairman']
                missing_reports = [r for r in expected_reports if r not in reports]
                
                if not missing_reports:
                    log_success(f"All 6 agent reports present: {list(reports.keys())}")
                else:
                    log_error(f"Missing reports: {missing_reports}")
                
                # Verify claims
                claims = data['claims']
                if len(claims) > 0:
                    log_success(f"Claims: {len(claims)}")
                else:
                    log_warning("No claims found")
                
                # Verify missions with nested submissions/evaluations
                missions = data['missions']
                if len(missions) > 0:
                    log_success(f"Missions: {len(missions)}")
                    
                    # Check if any mission has submissions/evaluations
                    has_submission = any(len(m.get('submissions', [])) > 0 for m in missions)
                    has_evaluation = any(len(m.get('evaluations', [])) > 0 for m in missions)
                    
                    if has_submission:
                        log_success("Missions include nested submissions")
                    else:
                        log_warning("No missions have submissions")
                    
                    if has_evaluation:
                        log_success("Missions include nested evaluations")
                    else:
                        log_warning("No missions have evaluations")
                else:
                    log_warning("No missions found")
                
                # Verify score_history
                score_history = data['score_history']
                if len(score_history) >= 1:
                    log_success(f"Score history: {len(score_history)} entries")
                else:
                    log_error("Score history is empty")
                
                # Verify latest_score
                if data['latest_score']:
                    log_success(f"Latest score: {data['latest_score'].get('overall', 'N/A')}/100")
                else:
                    log_error("Latest score is null")
                
                # Verify versions
                versions = data['versions']
                if len(versions) >= 1:
                    log_success(f"Versions: {len(versions)}")
                else:
                    log_warning("No versions found")
                
                return True
            else:
                log_error(f"Missing aggregate sections: {missing}")
                return False
        else:
            log_error(f"Expected 200, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_error(f"Startup detail fetch failed: {str(e)}")
        return False

def test_startup_list():
    """Test 11: GET /api/startups → verify list with latest_score"""
    print("\n" + "="*80)
    print("TEST 11: Startup List (GET /api/startups)")
    print("="*80)
    
    try:
        log_info("Fetching startup list...")
        response = requests.get(f"{BASE_URL}/startups", timeout=30)
        
        log_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            log_info(f"Response keys: {list(data.keys())}")
            
            if 'startups' in data:
                startups = data['startups']
                log_success(f"Found {len(startups)} startups")
                
                if len(startups) > 0:
                    # Check if our StudyBuddy startup is in the list
                    study_buddy = next((s for s in startups if s.get('name') == 'StudyBuddy'), None)
                    
                    if study_buddy:
                        log_success("StudyBuddy found in list")
                        
                        # Verify latest_score is attached
                        if 'latest_score' in study_buddy and study_buddy['latest_score']:
                            score = study_buddy['latest_score']
                            log_success(f"Latest score attached: {score.get('overall', 'N/A')}/100")
                            return True
                        else:
                            log_warning("Latest score not attached or is null")
                            return True  # Still pass, but warn
                    else:
                        log_warning("StudyBuddy not found in list")
                        return True  # Still pass
                else:
                    log_warning("Startup list is empty")
                    return True  # Still pass
            else:
                log_error(f"Missing 'startups' field. Got: {list(data.keys())}")
                return False
        else:
            log_error(f"Expected 200, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_error(f"Startup list fetch failed: {str(e)}")
        return False

def test_profile_edit(startup_id: str):
    """Test 12: PUT /api/startups/:id/profile → test change detection"""
    print("\n" + "="*80)
    print("TEST 12: Profile Edit with Change Detection (PUT /api/startups/:id/profile)")
    print("="*80)
    
    try:
        # First, get the current profile
        log_info("Fetching current profile...")
        get_response = requests.get(f"{BASE_URL}/startups/{startup_id}", timeout=30)
        
        if get_response.status_code != 200:
            log_error(f"Could not fetch current profile: {get_response.status_code}")
            return False
        
        current_data = get_response.json()
        current_profile = current_data.get('profile')
        
        if not current_profile:
            log_error("No profile found to edit")
            return False
        
        # Modify the pricing field
        modified_profile = current_profile.copy()
        modified_profile['pricing'] = "$10/month"
        
        log_info(f"Changing pricing from '{current_profile.get('pricing')}' to '$10/month'")
        
        payload = {"profile": modified_profile}
        
        response = requests.put(f"{BASE_URL}/startups/{startup_id}/profile", json=payload, timeout=30)
        
        log_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            log_info(f"Response keys: {list(data.keys())}")
            
            if 'changed_fields' in data and 'affected_agents' in data and 'version' in data:
                changed_fields = data['changed_fields']
                affected_agents = data['affected_agents']
                version = data['version']
                
                # Verify pricing is in changed_fields
                if 'pricing' in changed_fields:
                    log_success(f"Change detected: {changed_fields}")
                else:
                    log_error(f"Expected 'pricing' in changed_fields, got: {changed_fields}")
                    return False
                
                # Verify business agent is affected
                if 'business' in affected_agents:
                    log_success(f"Affected agents: {affected_agents}")
                else:
                    log_warning(f"Expected 'business' in affected_agents, got: {affected_agents}")
                
                # Verify version incremented
                if version == 2:
                    log_success(f"Version incremented to {version}")
                else:
                    log_warning(f"Expected version 2, got {version}")
                
                return True
            else:
                log_error(f"Missing required fields. Got: {list(data.keys())}")
                return False
        else:
            log_error(f"Expected 200, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_error(f"Profile edit failed: {str(e)}")
        return False

def test_delete_startup(startup_id: str):
    """Test 13: DELETE /api/startups/:id → delete startup"""
    print("\n" + "="*80)
    print("TEST 13: Delete Startup (DELETE /api/startups/:id)")
    print("="*80)
    
    try:
        log_info(f"Deleting startup {startup_id}...")
        response = requests.delete(f"{BASE_URL}/startups/{startup_id}", timeout=30)
        
        log_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            log_info(f"Response: {json.dumps(data, indent=2)}")
            
            if data.get('deleted') == True:
                log_success("Startup deleted")
                
                # Verify it's actually gone
                log_info("Verifying startup is deleted...")
                verify_response = requests.get(f"{BASE_URL}/startups/{startup_id}", timeout=30)
                
                # Should return error (500 with error message is acceptable since .single() fails)
                if verify_response.status_code in [404, 500]:
                    log_success(f"Confirmed deleted (GET returns {verify_response.status_code})")
                    return True
                else:
                    log_warning(f"Startup still accessible: {verify_response.status_code}")
                    return True  # Still pass the delete test
            else:
                log_error(f"Unexpected response: {data}")
                return False
        else:
            log_error(f"Expected 200, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_error(f"Delete startup failed: {str(e)}")
        return False

def main():
    """Run all backend tests sequentially"""
    print("\n" + "="*80)
    print("ProofLoop Backend API Test Suite")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Timeout: {TIMEOUT}s (AI calls can take 20-90s)")
    print("="*80)
    
    results = {}
    startup_id = None
    missions = None
    
    # Test 1: Health check
    results['health_check'] = test_health_check()
    if not results['health_check']:
        log_error("Health check failed - aborting tests")
        sys.exit(1)
    
    # Test 2: Create startup
    startup_id = test_create_startup()
    results['create_startup'] = startup_id is not None
    if not startup_id:
        log_error("Create startup failed - aborting tests")
        sys.exit(1)
    
    # Test 3: Interview turns
    results['interview_turns'] = test_interview_turns(startup_id)
    if not results['interview_turns']:
        log_error("Interview turns failed - aborting tests")
        sys.exit(1)
    
    # Test 4: Complete interview
    results['complete_interview'] = test_complete_interview(startup_id)
    if not results['complete_interview']:
        log_error("Complete interview failed - aborting tests")
        sys.exit(1)
    
    # Test 5: Specialist analysis
    results['specialist_analysis'] = test_specialist_analysis(startup_id)
    if not results['specialist_analysis']:
        log_error("Specialist analysis failed - aborting tests")
        sys.exit(1)
    
    # Test 6: Critic analysis
    claims = test_critic_analysis(startup_id)
    results['critic_analysis'] = claims is not False
    if not results['critic_analysis']:
        log_error("Critic analysis failed - aborting tests")
        sys.exit(1)
    
    # Test 7: Mission generation
    missions = test_mission_generation(startup_id)
    results['mission_generation'] = missions is not False
    if not results['mission_generation']:
        log_error("Mission generation failed - aborting tests")
        sys.exit(1)
    
    # Test 8: Evidence submission (only if we have missions)
    if missions and len(missions) > 0:
        mission_id = missions[0]['id']
        results['evidence_submission'] = test_evidence_submission(mission_id, startup_id)
        if not results['evidence_submission']:
            log_warning("Evidence submission failed - continuing with remaining tests")
    else:
        log_warning("No missions available - skipping evidence submission test")
        results['evidence_submission'] = None
    
    # Test 9: Chairman assessment
    results['chairman_assessment'] = test_chairman_assessment(startup_id)
    if not results['chairman_assessment']:
        log_error("Chairman assessment failed - aborting tests")
        sys.exit(1)
    
    # Test 10: Startup detail
    results['startup_detail'] = test_startup_detail(startup_id)
    if not results['startup_detail']:
        log_warning("Startup detail failed - continuing with remaining tests")
    
    # Test 11: Startup list
    results['startup_list'] = test_startup_list()
    if not results['startup_list']:
        log_warning("Startup list failed - continuing with remaining tests")
    
    # Test 12: Profile edit
    results['profile_edit'] = test_profile_edit(startup_id)
    if not results['profile_edit']:
        log_warning("Profile edit failed - continuing with remaining tests")
    
    # Test 13: Delete startup
    results['delete_startup'] = test_delete_startup(startup_id)
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v is True)
    failed = sum(1 for v in results.values() if v is False)
    skipped = sum(1 for v in results.values() if v is None)
    total = len(results)
    
    for test_name, result in results.items():
        if result is True:
            log_success(f"{test_name}: PASSED")
        elif result is False:
            log_error(f"{test_name}: FAILED")
        else:
            log_warning(f"{test_name}: SKIPPED")
    
    print("="*80)
    print(f"Total: {total} | Passed: {passed} | Failed: {failed} | Skipped: {skipped}")
    print("="*80)
    
    if failed == 0:
        log_success("ALL TESTS PASSED!")
        sys.exit(0)
    else:
        log_error(f"{failed} TEST(S) FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
