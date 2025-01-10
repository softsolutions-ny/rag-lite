from typing import Dict, Any
from datetime import datetime, timezone
import json
from pathlib import Path
import os

class ProcessingStats:
    def __init__(self):
        self.stats_dir = Path(__file__).parent / "stats"
        self.stats_dir.mkdir(exist_ok=True)
        print(f"[Stats] Initialized stats directory at {self.stats_dir}")
    
    def _get_utc_now(self) -> datetime:
        """Get current UTC timestamp"""
        return datetime.now(timezone.utc)
    
    def start_processing(self, job_id: str, filename: str) -> None:
        """Record the start of processing for a job"""
        stats = {
            "job_id": job_id,
            "filename": filename,
            "start_time": self._get_utc_now().isoformat(),
            "end_time": None,
            "duration_seconds": None,
            "status": "processing",
            "api_start_time": None,
            "api_end_time": None,
            "api_duration_seconds": None
        }
        self._save_stats(job_id, stats)
        print(f"[Stats] Started processing job {job_id} for file {filename}")
    
    def start_api_call(self, job_id: str) -> None:
        """Record the start of the API call"""
        stats = self._load_stats(job_id)
        if stats:
            stats["api_start_time"] = self._get_utc_now().isoformat()
            self._save_stats(job_id, stats)
    
    def end_api_call(self, job_id: str) -> None:
        """Record the end of the API call"""
        stats = self._load_stats(job_id)
        if stats and stats.get("api_start_time"):
            api_end_time = self._get_utc_now()
            api_start_time = datetime.fromisoformat(stats["api_start_time"])
            api_duration = (api_end_time - api_start_time).total_seconds()
            
            stats.update({
                "api_end_time": api_end_time.isoformat(),
                "api_duration_seconds": round(api_duration, 2)
            })
            self._save_stats(job_id, stats)
    
    def end_processing(self, job_id: str, status: str = "completed") -> Dict[str, Any]:
        """Record the end of processing and return the stats"""
        stats = self._load_stats(job_id)
        if stats:
            end_time = self._get_utc_now()
            start_time = datetime.fromisoformat(stats["start_time"])
            
            # Use API duration if available, otherwise use total duration
            if stats.get("api_duration_seconds") is not None:
                duration = stats["api_duration_seconds"]
            else:
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