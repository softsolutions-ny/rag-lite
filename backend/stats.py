from typing import Dict, Any
from datetime import datetime
import json
from pathlib import Path
import os

class ProcessingStats:
    def __init__(self):
        self.stats_dir = Path(__file__).parent / "stats"
        self.stats_dir.mkdir(exist_ok=True)
        print(f"[Stats] Initialized stats directory at {self.stats_dir}")
    
    def start_processing(self, job_id: str, filename: str) -> None:
        """Record the start of processing for a job"""
        stats = {
            "job_id": job_id,
            "filename": filename,
            "start_time": datetime.now().isoformat(),
            "end_time": None,
            "duration_seconds": None,
            "status": "processing"
        }
        self._save_stats(job_id, stats)
        print(f"[Stats] Started processing job {job_id} for file {filename}")
    
    def end_processing(self, job_id: str, status: str = "completed") -> Dict[str, Any]:
        """Record the end of processing and return the stats"""
        stats = self._load_stats(job_id)
        if stats:
            end_time = datetime.now()
            start_time = datetime.fromisoformat(stats["start_time"])
            duration = (end_time - start_time).total_seconds()
            
            stats.update({
                "end_time": end_time.isoformat(),
                "duration_seconds": round(duration, 2),
                "status": status
            })
            self._save_stats(job_id, stats)
            print(f"[Stats] Completed job {job_id} in {duration:.2f}s with status {status}")
            return stats
        print(f"[Stats] Warning: No stats found for job {job_id}")
        return {}
    
    def get_stats(self, job_id: str) -> Dict[str, Any]:
        """Get stats for a job"""
        return self._load_stats(job_id)
    
    def _get_stats_path(self, job_id: str) -> Path:
        return self.stats_dir / f"{job_id}.json"
    
    def _save_stats(self, job_id: str, stats: Dict[str, Any]) -> None:
        print(f"[Stats] Saving stats for job {job_id} to {self._get_stats_path(job_id)}")
        with open(self._get_stats_path(job_id), 'w') as f:
            json.dump(stats, f)
        print(f"[Stats] Saved stats: {stats}")
    
    def _load_stats(self, job_id: str) -> Dict[str, Any]:
        try:
            print(f"[Stats] Loading stats for job {job_id} from {self._get_stats_path(job_id)}")
            with open(self._get_stats_path(job_id), 'r') as f:
                stats = json.load(f)
                print(f"[Stats] Loaded stats: {stats}")
                return stats
        except (FileNotFoundError, json.JSONDecodeError):
            print(f"[Stats] No stats file found for job {job_id}")
            return {}
    
    def cleanup_stats(self, job_id: str) -> None:
        """Remove stats file for completed job"""
        try:
            os.remove(self._get_stats_path(job_id))
        except FileNotFoundError:
            pass

# Global instance
stats = ProcessingStats() 